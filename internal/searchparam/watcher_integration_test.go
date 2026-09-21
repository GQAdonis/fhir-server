//go:build integration

// Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

package searchparam_test

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/wso2/fhir-server/internal/searchparam"
	"github.com/wso2/fhir-server/internal/testutil"
)

func insertCustomParam(t *testing.T, ctx context.Context, pool *pgxpool.Pool, name string) {
	t.Helper()
	if _, err := pool.Exec(ctx, `
		INSERT INTO search_param_definitions (resource_type, param_name, param_type, fhirpath_expr, is_custom)
		VALUES ('Patient', $1, 'string', 'Patient.name.given', TRUE)
		ON CONFLICT (resource_type, param_name) DO NOTHING`, name); err != nil {
		t.Fatalf("insert custom param: %v", err)
	}
}

func waitForParam(t *testing.T, reg *searchparam.Registry, name string) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if _, ok := reg.Lookup("Patient", name); ok {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatalf("registry did not pick up Patient.%s", name)
}

func TestWatcher_ReloadsOnNotify(t *testing.T) {
	pool := testutil.MustSeededDB(t)
	reg := testutil.MustRegistry(t, pool)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	w := searchparam.NewWatcher(pool, reg)
	w.SetIntervals(time.Hour, 10*time.Millisecond) // poll must not be what triggers the reload
	go w.Run(ctx)
	<-w.Listening()

	insertCustomParam(t, ctx, pool, "watcher-notify-param")
	if err := searchparam.NotifyChange(ctx, pool, "test insert"); err != nil {
		t.Fatalf("notify: %v", err)
	}

	waitForParam(t, reg, "watcher-notify-param")
}

func TestWatcher_PollReloadsWithoutNotify(t *testing.T) {
	pool := testutil.MustSeededDB(t)
	reg := testutil.MustRegistry(t, pool)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	w := searchparam.NewWatcher(pool, reg)
	w.SetIntervals(20*time.Millisecond, time.Hour)
	go w.Run(ctx)
	<-w.Listening()

	insertCustomParam(t, ctx, pool, "watcher-poll-param")
	waitForParam(t, reg, "watcher-poll-param")
}

func TestWatcher_KeepsSnapshotOnReloadFailure(t *testing.T) {
	pool := testutil.MustSeededDB(t)
	reg := testutil.MustRegistry(t, pool)

	before := reg.ForResource("Patient")
	if len(before) == 0 {
		t.Fatal("expected seeded Patient search params")
	}
	pool.Close()

	w := searchparam.NewWatcher(pool, reg)
	w.ReloadForTest(context.Background())

	if after := reg.ForResource("Patient"); len(after) != len(before) {
		t.Fatalf("failed reload changed the snapshot: before=%d after=%d", len(before), len(after))
	}
}

func TestNotifyChange_ReachesListener(t *testing.T) {
	pool := testutil.MustSeededDB(t)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	conn, err := pgx.ConnectConfig(ctx, pool.Config().ConnConfig.Copy())
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer conn.Close(context.Background())

	const channel = "search_param_definitions_changed"
	if _, err := conn.Exec(ctx, "LISTEN "+channel); err != nil {
		t.Fatalf("listen: %v", err)
	}
	if err := searchparam.NotifyChange(ctx, pool, "hello"); err != nil {
		t.Fatalf("notify: %v", err)
	}

	waitCtx, waitCancel := context.WithTimeout(ctx, 5*time.Second)
	defer waitCancel()
	n, err := conn.WaitForNotification(waitCtx)
	if err != nil {
		t.Fatalf("wait for notification: %v", err)
	}
	if n.Channel != channel || n.Payload != "hello" {
		t.Fatalf("got channel=%q payload=%q", n.Channel, n.Payload)
	}
}
