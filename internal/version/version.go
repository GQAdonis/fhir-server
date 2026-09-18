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

// Package version exposes the build version of the FHIR server.
//
// The semantic version is resolved in this order:
//  1. The value injected at build time via
//     -ldflags "-X github.com/wso2/fhir-server/internal/version.Version=X.Y.Z"
//     (used by the release pipeline and `make build`).
//  2. Otherwise the embedded version.txt file from the repository root, so a plain
//     `go build` or `go install` still reports a meaningful version.
//
// The git commit and build time are read from the Go build info that the
// toolchain embeds automatically (Go 1.18+), so they need no ldflags.
package version

import (
	"fmt"
	"runtime/debug"
	"strings"

	fhirserver "github.com/wso2/fhir-server"
)

// Version is overridden at link time via -ldflags -X. Leave it empty here so
// package initialisation does not clobber a linker-provided value; when it is
// empty we fall back to the embedded version.txt file.
var Version = ""

// fallbackVersion is used during tests or overrides.
var fallbackVersion = ""

// Current returns the resolved semantic version of the FHIR server.
// It is equivalent to the first return value of Info().
func Current() string {
	v, _, _ := Info()
	return v
}

// Info returns the resolved semantic version, the VCS commit, and the build
// time. commit and date are "unknown" when the binary was not built from a
// VCS checkout (e.g. from an extracted archive).
func Info() (version, commit, date string) {
	version = cleanVersion(Version)
	if version == "" {
		version = cleanVersion(fallbackVersion)
	}
	if version == "" {
		version = cleanVersion(fhirserver.EmbeddedVersion())
	}
	if version == "" {
		version = "dev"
	}

	commit, date = "unknown", "unknown"
	if bi, ok := debug.ReadBuildInfo(); ok {
		for _, s := range bi.Settings {
			switch s.Key {
			case "vcs.revision":
				commit = s.Value
			case "vcs.time":
				date = s.Value
			}
		}
	}
	return version, commit, date
}

// String renders a single human-readable version line, e.g.
// "fhir-server 0.5.0 (commit abc1234, built 2026-07-01T12:00:00Z)".
func String() string {
	v, c, d := Info()
	return fmt.Sprintf("fhir-server %s (commit %s, built %s)", v, c, d)
}

// cleanVersion trims whitespace and removes an optional leading 'v'.
func cleanVersion(v string) string {
	v = strings.TrimSpace(v)
	return strings.TrimPrefix(v, "v")
}
