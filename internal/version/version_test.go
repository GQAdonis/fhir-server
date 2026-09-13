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

package version

import (
	"strings"
	"testing"
)

// TestVersion_Default verifies that Current() and Info() fall back to the embedded
// VERSION file when no linker Version override is present.
func TestVersion_Default(t *testing.T) {
	origVersion := Version
	origEmbedded := embeddedVersion
	defer func() {
		Version = origVersion
		embeddedVersion = origEmbedded
	}()

	embeddedVersion = "2.0.1-dev\n"
	Version = ""

	if got := Current(); got != "2.0.1-dev" {
		t.Errorf("Current(): got %q, want %q", got, "2.0.1-dev")
	}

	v, commit, date := Info()
	if v != "2.0.1-dev" {
		t.Errorf("Info() version: got %q, want %q", v, "2.0.1-dev")
	}
	if commit == "" {
		t.Error("Info() commit should not be empty")
	}
	if date == "" {
		t.Error("Info() date should not be empty")
	}

	str := String()
	if !strings.HasPrefix(str, "fhir-server 2.0.1-dev") {
		t.Errorf("String(): got %q, want prefix %q", str, "fhir-server 2.0.1-dev")
	}
}

// TestVersion_LinkerOverride verifies that Current() and Info() honor the linker-injected
// Version override when provided.
func TestVersion_LinkerOverride(t *testing.T) {
	origVersion := Version
	origEmbedded := embeddedVersion
	defer func() {
		Version = origVersion
		embeddedVersion = origEmbedded
	}()

	embeddedVersion = "2.0.1-dev"
	Version = "1.2.3"

	if got := Current(); got != "1.2.3" {
		t.Errorf("Current(): got %q, want %q", got, "1.2.3")
	}

	v, _, _ := Info()
	if v != "1.2.3" {
		t.Errorf("Info() version: got %q, want %q", v, "1.2.3")
	}
}

// TestVersion_FallbackDev verifies that Current() returns "dev" when neither the linker
// flag nor an embedded version string is present.
func TestVersion_FallbackDev(t *testing.T) {
	origVersion := Version
	origEmbedded := embeddedVersion
	defer func() {
		Version = origVersion
		embeddedVersion = origEmbedded
	}()

	embeddedVersion = ""
	Version = ""

	if got := Current(); got != "dev" {
		t.Errorf("Current(): got %q, want %q", got, "dev")
	}
}
