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

package config_test

import (
	"strings"
	"testing"

	"github.com/wso2/fhir-server/internal/config"
)

func TestSearchParamsWatch_DefaultOff(t *testing.T) {
	clearIGEnv(t)
	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.SearchParams.Watch {
		t.Error("default SearchParams.Watch should be false")
	}
}

func TestSearchParamsWatch_YAMLEnables(t *testing.T) {
	clearIGEnv(t)
	path := writeConfigFile(t, `
searchParams:
  watch: true
`)
	cfg, err := config.LoadFromPath(path)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !cfg.SearchParams.Watch {
		t.Error("YAML searchParams.watch=true should enable the watcher")
	}
}

func TestSearchParamsWatch_EnvOverridesYAML(t *testing.T) {
	clearIGEnv(t)
	path := writeConfigFile(t, `
searchParams:
  watch: false
`)
	t.Setenv("SEARCH_PARAM_WATCH", "true")
	cfg, err := config.LoadFromPath(path)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !cfg.SearchParams.Watch {
		t.Error("env SEARCH_PARAM_WATCH should override the YAML value")
	}
}

func TestSearchParamsWatch_InvalidBoolFailsFast(t *testing.T) {
	clearIGEnv(t)
	t.Setenv("SEARCH_PARAM_WATCH", "banana")
	_, err := config.Load()
	if err == nil {
		t.Fatal("expected an error for an unparseable boolean")
	}
	if !strings.Contains(err.Error(), "SEARCH_PARAM_WATCH") {
		t.Errorf("error should name the offending variable, got: %v", err)
	}
}
