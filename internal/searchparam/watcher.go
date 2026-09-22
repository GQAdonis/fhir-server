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

// watch reloads the registry on a change notification and after a reconnect. A
// single timer drives both the debounce and the failed-reload backoff: a
// notification (re)arms it for the debounce interval, a failed reload for a
// growing retry interval.
func (w *Watcher) watch(ctx context.Context) error {
	conn, err := w.connect(ctx)
	if err != nil {
		return fmt.Errorf("connect watcher: %w", err)
	}
	defer conn.Close(context.Background())

	if _, err := conn.Exec(ctx, "LISTEN "+notifyChannel); err != nil {
		return fmt.Errorf("listen on %s: %w", notifyChannel, err)
	}
	w.signalListening()

	notifications, readErr := watchNotifications(ctx, conn)

	timer := time.NewTimer(0)
	timer.Stop()
	defer stopTimer(timer)

	var (
		timerC  <-chan time.Time
		trigger string
		retryIn = watchReloadRetryMin
	)
	if !w.reload(ctx, "connect") {
		timerC, trigger = armTimer(timer, retryIn), "retry"
		retryIn = min(retryIn*2, watchReloadRetryMax)
	}

	for {
		select {
		case <-ctx.Done():
			return nil
		case err := <-readErr:
			return fmt.Errorf("wait for notification: %w", err)
		case <-notifications:
			timerC, trigger = armTimer(timer, w.debounce), "notify"
		case <-timerC:
			timerC = nil
			if w.reload(ctx, trigger) {
				retryIn = watchReloadRetryMin
				continue
			}
			timerC, trigger = armTimer(timer, retryIn), "retry"
			retryIn = min(retryIn*2, watchReloadRetryMax)
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

// watchNotifications forwards server notifications to the returned channel (at
// most one pending) and reports a read failure on the error channel.
func watchNotifications(ctx context.Context, conn *pgx.Conn) (<-chan struct{}, <-chan error) {
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
	return notifications, readErr
}

// signalListening records the first successful connect; later calls are no-ops.
func (w *Watcher) signalListening() {
	select {
	case w.listening <- struct{}{}:
	default:
	}
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

func armTimer(t *time.Timer, d time.Duration) <-chan time.Time {
	stopTimer(t)
	t.Reset(d)
	return t.C
}

func stopTimer(t *time.Timer) {
	if !t.Stop() {
		select {
		case <-t.C:
		default:
		}
	}
}
