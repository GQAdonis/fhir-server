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

package searchparam

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	notifyChannel       = "search_param_definitions_changed"
	watchDebounce       = 500 * time.Millisecond
	watchReconnectMin   = time.Second
	watchReconnectMax   = 30 * time.Second
	watchReloadRetryMin = time.Second
	watchReloadRetryMax = 30 * time.Second
	watchKeepAlive      = 30 * time.Second
)

// Execer is the database interface the change notification needs.
type Execer interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// NotifyChange announces a registry change to the other replicas.
func NotifyChange(ctx context.Context, db Execer, detail string) error {
	if _, err := db.Exec(ctx, "SELECT pg_notify($1, $2)", notifyChannel, detail); err != nil {
		return fmt.Errorf("notify %s: %w", notifyChannel, err)
	}
	return nil
}

// Watcher keeps a Registry in sync with search_param_definitions across replicas.
type Watcher struct {
	pool      *pgxpool.Pool
	registry  *Registry
	debounce  time.Duration
	listening chan struct{}
}

func NewWatcher(pool *pgxpool.Pool, registry *Registry) *Watcher {
	return &Watcher{
		pool:      pool,
		registry:  registry,
		debounce:  watchDebounce,
		listening: make(chan struct{}, 1),
	}
}

// Run blocks until ctx is cancelled, reconnecting if the connection drops.
func (w *Watcher) Run(ctx context.Context) {
	backoff := watchReconnectMin
	for ctx.Err() == nil {
		start := time.Now()
		err := w.watch(ctx)
		if ctx.Err() != nil {
			return
		}
		if time.Since(start) >= watchReconnectMax {
			backoff = watchReconnectMin
		}
		slog.Warn("search param watcher disconnected; retrying", "err", err, "backoff", backoff)
		select {
		case <-ctx.Done():
			return
		case <-time.After(backoff):
		}
		backoff = min(backoff*2, watchReconnectMax)
	}
}

// watch reloads the registry on a change notification and after a reconnect,
// retrying failures with backoff.
func (w *Watcher) watch(ctx context.Context) error {
	conn, err := w.connect(ctx)
	if err != nil {
		return fmt.Errorf("connect watcher: %w", err)
	}
	defer conn.Close(context.Background())

	if _, err := conn.Exec(ctx, "LISTEN "+notifyChannel); err != nil {
		return fmt.Errorf("listen on %s: %w", notifyChannel, err)
	}
	select {
	case w.listening <- struct{}{}:
	default:
	}

	notifications := make(chan struct{}, 1)
	readErr := make(chan error, 1)
	go func() {
		for {
			if _, err := conn.WaitForNotification(ctx); err != nil {
				readErr <- err
				return
			}
			select {
			case notifications <- struct{}{}:
			case <-ctx.Done():
				return
			}
		}
	}()

	var (
		debounce   *time.Timer
		debounceC  <-chan time.Time
		retry      *time.Timer
		retryC     <-chan time.Time
		retryDelay = watchReloadRetryMin
	)
	defer func() {
		stopTimer(debounce)
		stopTimer(retry)
	}()

	scheduleRetry := func() {
		stopTimer(retry)
		if retry == nil {
			retry = time.NewTimer(retryDelay)
		} else {
			retry.Reset(retryDelay)
		}
		retryC = retry.C
		retryDelay = min(retryDelay*2, watchReloadRetryMax)
	}
	if !w.reload(ctx, "connect") {
		scheduleRetry()
	}

	for {
		select {
		case <-ctx.Done():
			return nil
		case err := <-readErr:
			return fmt.Errorf("wait for notification: %w", err)
		case <-notifications:
			if debounce == nil {
				debounce = time.NewTimer(w.debounce)
			} else {
				debounce.Reset(w.debounce)
			}
			debounceC = debounce.C
		case <-debounceC:
			debounceC = nil
			if w.reload(ctx, "notify") {
				stopTimer(retry)
				retryC = nil
				retryDelay = watchReloadRetryMin
			} else {
				scheduleRetry()
			}
		case <-retryC:
			retryC = nil
			if w.reload(ctx, "retry") {
				retryDelay = watchReloadRetryMin
			} else {
				scheduleRetry()
			}
		}
	}
}

// connect opens the dedicated connection used to listen for change notifications.
func (w *Watcher) connect(ctx context.Context) (*pgx.Conn, error) {
	cfg := w.pool.Config().ConnConfig.Copy()
	dialer := &net.Dialer{KeepAlive: watchKeepAlive}
	cfg.DialFunc = dialer.DialContext
	return pgx.ConnectConfig(ctx, cfg)
}

// reload refreshes the registry, keeping the previous snapshot on failure.
func (w *Watcher) reload(ctx context.Context, trigger string) bool {
	if _, err := w.registry.load(ctx, w.pool); err != nil {
		if ctx.Err() != nil {
			return true
		}
		slog.Warn("search param registry reload failed; keeping previous snapshot", "trigger", trigger, "err", err)
		return false
	}
	slog.Debug("search param registry reloaded", "trigger", trigger)
	return true
}

func stopTimer(t *time.Timer) {
	if t == nil {
		return
	}
	if !t.Stop() {
		select {
		case <-t.C:
		default:
		}
	}
}
