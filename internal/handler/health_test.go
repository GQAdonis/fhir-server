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
	p := newReadinessProbe(nil)
	if !p.dbReachable(context.Background()) {
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
			p := newReadinessProbe(&fakePinger{err: tc.err})
			if got := p.dbReachable(context.Background()); got != tc.want {
				t.Fatalf("want %v, got %v", tc.want, got)
			}
		})
	}
}

func TestReadinessProbe_CachesUntilTTL(t *testing.T) {
	now := time.Now()
	clock := func() time.Time { return now }
	cases := []struct {
		name    string
		err     error
		advance time.Duration
		want    bool
	}{
		{"cached success inside ttl", nil, 0, true},
		{"re-probed success after ttl", nil, 3 * time.Second, true},
		{"cached failure inside ttl", errors.New("down"), 0, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := &fakePinger{err: tc.err}
			p := newReadinessProbe(f)
			p.now = clock
			p.ttl = 2 * time.Second

			if got := p.dbReachable(context.Background()); got != (tc.err == nil) {
				t.Fatalf("first probe: want %v, got %v", tc.err == nil, got)
			}
			now = now.Add(tc.advance)
			if got := p.dbReachable(context.Background()); got != tc.want {
				t.Fatalf("second probe: want %v, got %v", tc.want, got)
			}
			wantCalls := int32(1)
			if tc.advance > 0 {
				wantCalls = 2
			}
			if got := f.calls.Load(); got != wantCalls {
				t.Fatalf("want %d ping(s), got %d", wantCalls, got)
			}
		})
	}
}

func TestReadinessProbe_RecoversAfterFailure(t *testing.T) {
	now := time.Now()
	f := &fakePinger{err: errors.New("down")}
	p := newReadinessProbe(f)
	p.now = func() time.Time { return now }
	p.ttl = 2 * time.Second

	if p.dbReachable(context.Background()) {
		t.Fatal("want unreachable while ping fails")
	}
	f.err = nil
	now = now.Add(3 * time.Second)
	if !p.dbReachable(context.Background()) {
		t.Fatal("want reachable once ping succeeds after ttl")
	}
}

func TestReadinessProbe_IgnoresCallerCancellation(t *testing.T) {
	p := newReadinessProbe(&fakePinger{})
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	if !p.dbReachable(ctx) {
		t.Fatal("want reachable: caller cancellation must not cancel the ping")
	}
}

func TestReadinessProbe_PingHonoursTimeout(t *testing.T) {
	p := newReadinessProbe(&fakePinger{block: true})
	p.timeout = 20 * time.Millisecond

	start := time.Now()
	if p.dbReachable(context.Background()) {
		t.Fatal("want unreachable when ping exceeds timeout")
	}
	if elapsed := time.Since(start); elapsed >= time.Second {
		t.Fatalf("probe took %v, want it bounded by the timeout", elapsed)
	}
}
