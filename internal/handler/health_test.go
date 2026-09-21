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

package handler

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"
)

type fakePinger struct {
	err   error
	block bool
	calls atomic.Int32
}

func (f *fakePinger) Ping(ctx context.Context) error {
	f.calls.Add(1)
	if f.block {
		<-ctx.Done()
		return ctx.Err()
	}
	return f.err
}

func TestReadinessProbe_NilPoolAlwaysReachable(t *testing.T) {
	if !dbReachable(context.Background(), nil, readinessPingTimeout) {
		t.Fatal("want reachable when no pool is configured")
	}
}

func TestReadinessProbe_PingOutcome(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want bool
	}{
		{"reachable", nil, true},
		{"unreachable", errors.New("connection refused"), false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := &fakePinger{err: tc.err}
			if got := dbReachable(context.Background(), f, readinessPingTimeout); got != tc.want {
				t.Fatalf("want %v, got %v", tc.want, got)
			}
		})
	}
}

func TestReadinessProbe_NoCaching(t *testing.T) {
	f := &fakePinger{err: errors.New("down")}
	ctx := context.Background()

	if dbReachable(ctx, f, readinessPingTimeout) {
		t.Fatal("want unreachable while ping fails")
	}
	f.err = nil
	if !dbReachable(ctx, f, readinessPingTimeout) {
		t.Fatal("want reachable as soon as the ping succeeds")
	}
	if got := f.calls.Load(); got != 2 {
		t.Fatalf("want 2 pings, got %d", got)
	}
}

func TestReadinessProbe_IgnoresCallerCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	if !dbReachable(ctx, &fakePinger{}, readinessPingTimeout) {
		t.Fatal("want reachable: caller cancellation must not cancel the ping")
	}
}

func TestReadinessProbe_PingHonoursTimeout(t *testing.T) {
	start := time.Now()
	if dbReachable(context.Background(), &fakePinger{block: true}, 20*time.Millisecond) {
		t.Fatal("want unreachable when ping exceeds timeout")
	}
	if elapsed := time.Since(start); elapsed >= time.Second {
		t.Fatalf("probe took %v, want it bounded by the timeout", elapsed)
	}
}
