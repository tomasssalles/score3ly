// The list of models and prices the app uses (docs/llm.md, "The list of models and prices: code, generated").
// Generated from apps/worker/model-list/*.json by `npm run model-list -w apps/worker`: don't edit it by hand.

import type { ModelList } from "./models.ts";

export const MODEL_LIST: ModelList = {
  "asOf": "2026-11-05",
  "models": [
    {
      "id": "claude-fable-5-1",
      "name": "Claude Fable 5.1",
      "family": "claude",
      "strings": {
        "anthropic": "claude-fable-5-1",
        "bedrock": "anthropic.claude-fable-5-1",
        "vertex": "claude-fable-5-1"
      },
      "efforts": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ]
    },
    {
      "id": "claude-mythos-5-1",
      "name": "Claude Mythos 5.1",
      "family": "claude",
      "strings": {
        "anthropic": "claude-mythos-5-1"
      },
      "efforts": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ]
    },
    {
      "id": "claude-fable-5",
      "name": "Claude Fable 5",
      "family": "claude",
      "strings": {
        "anthropic": "claude-fable-5",
        "bedrock": "anthropic.claude-fable-5",
        "vertex": "claude-fable-5"
      },
      "efforts": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ]
    },
    {
      "id": "claude-mythos-5",
      "name": "Claude Mythos 5",
      "family": "claude",
      "strings": {
        "anthropic": "claude-mythos-5"
      },
      "efforts": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ]
    },
    {
      "id": "claude-opus-5-5",
      "name": "Claude Opus 5.5",
      "family": "claude",
      "strings": {
        "anthropic": "claude-opus-5-5",
        "bedrock": "anthropic.claude-opus-5-5",
        "vertex": "claude-opus-5-5"
      },
      "efforts": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ]
    },
    {
      "id": "claude-opus-5",
      "name": "Claude Opus 5",
      "family": "claude",
      "strings": {
        "anthropic": "claude-opus-5",
        "bedrock": "anthropic.claude-opus-5",
        "vertex": "claude-opus-5"
      },
      "efforts": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ]
    },
    {
      "id": "claude-opus-4-8",
      "name": "Claude Opus 4.8",
      "family": "claude",
      "strings": {
        "anthropic": "claude-opus-4-8",
        "bedrock": "anthropic.claude-opus-4-8",
        "vertex": "claude-opus-4-8"
      },
      "efforts": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "thinking": "adaptive"
    },
    {
      "id": "claude-opus-4-7",
      "name": "Claude Opus 4.7",
      "family": "claude",
      "strings": {
        "anthropic": "claude-opus-4-7",
        "bedrock": "anthropic.claude-opus-4-7",
        "vertex": "claude-opus-4-7"
      },
      "efforts": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ],
      "thinking": "adaptive"
    },
    {
      "id": "claude-opus-4-6",
      "name": "Claude Opus 4.6",
      "family": "claude",
      "strings": {
        "anthropic": "claude-opus-4-6",
        "bedrock": "anthropic.claude-opus-4-6-v1",
        "vertex": "claude-opus-4-6"
      },
      "efforts": [
        "low",
        "medium",
        "high",
        "max"
      ],
      "thinking": "adaptive"
    },
    {
      "id": "claude-opus-4-5",
      "name": "Claude Opus 4.5",
      "family": "claude",
      "strings": {
        "anthropic": "claude-opus-4-5-20251101",
        "bedrock": "anthropic.claude-opus-4-5-20251101-v1:0",
        "vertex": "claude-opus-4-5@20251101"
      },
      "efforts": [
        "low",
        "medium",
        "high"
      ]
    },
    {
      "id": "claude-sonnet-5-5",
      "name": "Claude Sonnet 5.5",
      "family": "claude",
      "strings": {
        "anthropic": "claude-sonnet-5-5",
        "bedrock": "anthropic.claude-sonnet-5-5",
        "vertex": "claude-sonnet-5-5"
      },
      "efforts": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ]
    },
    {
      "id": "claude-sonnet-5",
      "name": "Claude Sonnet 5",
      "family": "claude",
      "strings": {
        "anthropic": "claude-sonnet-5",
        "bedrock": "anthropic.claude-sonnet-5",
        "vertex": "claude-sonnet-5"
      },
      "efforts": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ]
    },
    {
      "id": "claude-sonnet-4-6",
      "name": "Claude Sonnet 4.6",
      "family": "claude",
      "strings": {
        "anthropic": "claude-sonnet-4-6",
        "bedrock": "anthropic.claude-sonnet-4-6",
        "vertex": "claude-sonnet-4-6"
      },
      "efforts": [
        "low",
        "medium",
        "high",
        "max"
      ],
      "thinking": "adaptive"
    },
    {
      "id": "claude-sonnet-4-5",
      "name": "Claude Sonnet 4.5",
      "family": "claude",
      "strings": {
        "anthropic": "claude-sonnet-4-5-20250929",
        "bedrock": "anthropic.claude-sonnet-4-5-20250929-v1:0",
        "vertex": "claude-sonnet-4-5@20250929"
      },
      "efforts": []
    },
    {
      "id": "claude-haiku-5-5",
      "name": "Claude Haiku 5.5",
      "family": "claude",
      "strings": {
        "anthropic": "claude-haiku-5-5",
        "bedrock": "anthropic.claude-haiku-5-5",
        "vertex": "claude-haiku-5-5"
      },
      "efforts": [
        "low",
        "medium",
        "high",
        "xhigh",
        "max"
      ]
    },
    {
      "id": "claude-haiku-4-5",
      "name": "Claude Haiku 4.5",
      "family": "claude",
      "strings": {
        "anthropic": "claude-haiku-4-5-20251001",
        "bedrock": "anthropic.claude-haiku-4-5-20251001-v1:0",
        "vertex": "claude-haiku-4-5@20251001"
      },
      "efforts": []
    },
    {
      "id": "claude-opus-4-1",
      "name": "Claude Opus 4.1",
      "family": "claude",
      "strings": {
        "bedrock": "anthropic.claude-opus-4-1-20250805-v1:0"
      },
      "efforts": []
    },
    {
      "id": "claude-sonnet-4",
      "name": "Claude Sonnet 4",
      "family": "claude",
      "strings": {
        "bedrock": "anthropic.claude-sonnet-4-20250514-v1:0"
      },
      "efforts": []
    },
    {
      "id": "gemini-4-argon",
      "name": "Gemini 4 Argon",
      "family": "gemini",
      "strings": {
        "ai-studio": "gemini-4-argon",
        "vertex": "gemini-4-argon"
      },
      "efforts": [
        "low",
        "medium",
        "high"
      ]
    },
    {
      "id": "gemini-3-8-flash",
      "name": "Gemini 3.8 Flash",
      "family": "gemini",
      "strings": {
        "ai-studio": "gemini-3.8-flash",
        "vertex": "gemini-3.8-flash"
      },
      "efforts": [
        "low",
        "medium",
        "high"
      ]
    },
    {
      "id": "gemini-3-6-flash",
      "name": "Gemini 3.6 Flash",
      "family": "gemini",
      "strings": {
        "ai-studio": "gemini-3.6-flash",
        "vertex": "gemini-3.6-flash"
      },
      "efforts": [
        "low",
        "medium",
        "high"
      ]
    },
    {
      "id": "gemini-3-5-flash-lite",
      "name": "Gemini 3.5 Flash-Lite",
      "family": "gemini",
      "strings": {
        "ai-studio": "gemini-3.5-flash-lite",
        "vertex": "gemini-3.5-flash-lite"
      },
      "efforts": [
        "low",
        "medium",
        "high"
      ]
    },
    {
      "id": "gemini-3-1-flash-lite",
      "name": "Gemini 3.1 Flash-Lite",
      "family": "gemini",
      "strings": {
        "ai-studio": "gemini-3.1-flash-lite",
        "vertex": "gemini-3.1-flash-lite"
      },
      "efforts": [
        "low",
        "medium",
        "high"
      ]
    },
    {
      "id": "gemini-3-1-pro-preview",
      "name": "Gemini 3.1 Pro Preview",
      "family": "gemini",
      "strings": {
        "ai-studio": "gemini-3.1-pro-preview",
        "vertex": "gemini-3.1-pro-preview"
      },
      "efforts": [
        "low",
        "medium",
        "high"
      ]
    },
    {
      "id": "gemini-3-flash-preview",
      "name": "Gemini 3 Flash Preview",
      "family": "gemini",
      "strings": {
        "ai-studio": "gemini-3-flash-preview"
      },
      "efforts": [
        "low",
        "medium",
        "high"
      ]
    },
    {
      "id": "gemini-2-5-pro",
      "name": "Gemini 2.5 Pro",
      "family": "gemini",
      "strings": {
        "ai-studio": "gemini-2.5-pro",
        "vertex": "gemini-2.5-pro"
      },
      "efforts": [
        "low",
        "medium",
        "high"
      ]
    },
    {
      "id": "gemini-2-5-flash",
      "name": "Gemini 2.5 Flash",
      "family": "gemini",
      "strings": {
        "ai-studio": "gemini-2.5-flash",
        "vertex": "gemini-2.5-flash"
      },
      "efforts": [
        "low",
        "medium",
        "high"
      ]
    },
    {
      "id": "gemini-2-5-flash-lite",
      "name": "Gemini 2.5 Flash-Lite",
      "family": "gemini",
      "strings": {
        "ai-studio": "gemini-2.5-flash-lite",
        "vertex": "gemini-2.5-flash-lite"
      },
      "efforts": [
        "low",
        "medium",
        "high"
      ]
    },
    {
      "id": "gemini-3-7-flash",
      "name": "Gemini 3.7 Flash",
      "family": "gemini",
      "strings": {
        "vertex": "gemini-3.7-flash"
      },
      "efforts": [
        "low",
        "medium",
        "high"
      ]
    },
    {
      "id": "gemini-3-5-flash",
      "name": "Gemini 3.5 Flash",
      "family": "gemini",
      "strings": {
        "vertex": "gemini-3.5-flash"
      },
      "efforts": [
        "low",
        "medium",
        "high"
      ]
    },
    {
      "id": "fake",
      "name": "Fake model",
      "family": "fake",
      "strings": {
        "fake": "fake",
        "fake-dev": "fake"
      }
    },
    {
      "id": "gemini-3-1-pro",
      "name": "Gemini 3.1 Pro",
      "family": "gemini",
      "strings": {
        "vertex": "gemini-3.1-pro"
      },
      "retired": true
    },
    {
      "id": "gemini-3-flash",
      "name": "Gemini 3 Flash",
      "family": "gemini",
      "strings": {
        "vertex": "gemini-3-flash"
      },
      "retired": true
    }
  ],
  "regions": [
    {
      "provider": "anthropic",
      "region": "",
      "routings": null
    },
    {
      "provider": "bedrock",
      "region": "af-south-1",
      "routings": [
        "global"
      ]
    },
    {
      "provider": "bedrock",
      "region": "ap-east-2",
      "routings": [
        "global"
      ]
    },
    {
      "provider": "bedrock",
      "region": "ap-northeast-1",
      "routings": [
        "global",
        "geographic"
      ],
      "geography": "JP"
    },
    {
      "provider": "bedrock",
      "region": "ap-northeast-2",
      "routings": [
        "global",
        "geographic",
        "in-region"
      ],
      "geography": "APAC"
    },
    {
      "provider": "bedrock",
      "region": "ap-northeast-3",
      "routings": [
        "global",
        "geographic"
      ],
      "geography": "JP"
    },
    {
      "provider": "bedrock",
      "region": "ap-south-1",
      "routings": [
        "global",
        "geographic"
      ],
      "geography": "IN"
    },
    {
      "provider": "bedrock",
      "region": "ap-south-2",
      "routings": [
        "global",
        "geographic"
      ],
      "geography": "IN"
    },
    {
      "provider": "bedrock",
      "region": "ap-southeast-1",
      "routings": [
        "global",
        "geographic",
        "in-region"
      ],
      "geography": "APAC"
    },
    {
      "provider": "bedrock",
      "region": "ap-southeast-2",
      "routings": [
        "global",
        "geographic"
      ],
      "geography": "AU"
    },
    {
      "provider": "bedrock",
      "region": "ap-southeast-3",
      "routings": [
        "global"
      ]
    },
    {
      "provider": "bedrock",
      "region": "ap-southeast-4",
      "routings": [
        "global",
        "geographic"
      ],
      "geography": "AU"
    },
    {
      "provider": "bedrock",
      "region": "ap-southeast-5",
      "routings": [
        "global"
      ]
    },
    {
      "provider": "bedrock",
      "region": "ap-southeast-6",
      "routings": [
        "global",
        "geographic"
      ],
      "geography": "AU"
    },
    {
      "provider": "bedrock",
      "region": "ap-southeast-7",
      "routings": [
        "global"
      ]
    },
    {
      "provider": "bedrock",
      "region": "ca-central-1",
      "routings": [
        "global",
        "geographic"
      ],
      "geography": "US"
    },
    {
      "provider": "bedrock",
      "region": "ca-west-1",
      "routings": [
        "global",
        "geographic"
      ],
      "geography": "US"
    },
    {
      "provider": "bedrock",
      "region": "eu-central-1",
      "routings": [
        "global",
        "geographic"
      ],
      "geography": "EU"
    },
    {
      "provider": "bedrock",
      "region": "eu-central-2",
      "routings": [
        "global",
        "geographic"
      ],
      "geography": "EU"
    },
    {
      "provider": "bedrock",
      "region": "eu-north-1",
      "routings": [
        "global",
        "geographic"
      ],
      "geography": "EU"
    },
    {
      "provider": "bedrock",
      "region": "eu-south-1",
      "routings": [
        "global",
        "geographic"
      ],
      "geography": "EU"
    },
    {
      "provider": "bedrock",
      "region": "eu-south-2",
      "routings": [
        "global",
        "geographic"
      ],
      "geography": "EU"
    },
    {
      "provider": "bedrock",
      "region": "eu-west-1",
      "routings": [
        "global",
        "geographic"
      ],
      "geography": "EU"
    },
    {
      "provider": "bedrock",
      "region": "eu-west-2",
      "routings": [
        "global",
        "geographic",
        "in-region"
      ],
      "geography": "EU"
    },
    {
      "provider": "bedrock",
      "region": "eu-west-3",
      "routings": [
        "global",
        "geographic"
      ],
      "geography": "EU"
    },
    {
      "provider": "bedrock",
      "region": "il-central-1",
      "routings": [
        "global",
        "geographic"
      ],
      "geography": "EU"
    },
    {
      "provider": "bedrock",
      "region": "me-central-1",
      "routings": [
        "global"
      ]
    },
    {
      "provider": "bedrock",
      "region": "me-south-1",
      "routings": [
        "global"
      ]
    },
    {
      "provider": "bedrock",
      "region": "mx-central-1",
      "routings": [
        "global"
      ]
    },
    {
      "provider": "bedrock",
      "region": "sa-east-1",
      "routings": [
        "global"
      ]
    },
    {
      "provider": "bedrock",
      "region": "us-east-1",
      "routings": [
        "global",
        "geographic"
      ],
      "geography": "US"
    },
    {
      "provider": "bedrock",
      "region": "us-east-2",
      "routings": [
        "global",
        "geographic"
      ],
      "geography": "US"
    },
    {
      "provider": "bedrock",
      "region": "us-gov-east-1",
      "routings": [
        "geographic"
      ],
      "geography": "US"
    },
    {
      "provider": "bedrock",
      "region": "us-gov-west-1",
      "routings": [
        "geographic"
      ],
      "geography": "US"
    },
    {
      "provider": "bedrock",
      "region": "us-west-1",
      "routings": [
        "global",
        "geographic"
      ],
      "geography": "US"
    },
    {
      "provider": "bedrock",
      "region": "us-west-2",
      "routings": [
        "global",
        "geographic"
      ],
      "geography": "US"
    },
    {
      "provider": "ai-studio",
      "region": "",
      "routings": null
    },
    {
      "provider": "vertex",
      "region": "global",
      "routings": null
    },
    {
      "provider": "vertex",
      "region": "eu",
      "routings": null
    },
    {
      "provider": "vertex",
      "region": "us",
      "routings": null
    },
    {
      "provider": "vertex",
      "region": "asia-east1",
      "routings": null
    },
    {
      "provider": "vertex",
      "region": "asia-northeast1",
      "routings": null
    },
    {
      "provider": "vertex",
      "region": "asia-northeast3",
      "routings": null
    },
    {
      "provider": "vertex",
      "region": "asia-south1",
      "routings": null
    },
    {
      "provider": "vertex",
      "region": "asia-southeast1",
      "routings": null
    },
    {
      "provider": "vertex",
      "region": "australia-southeast1",
      "routings": null
    },
    {
      "provider": "vertex",
      "region": "europe-central2",
      "routings": null
    },
    {
      "provider": "vertex",
      "region": "europe-north1",
      "routings": null
    },
    {
      "provider": "vertex",
      "region": "europe-southwest1",
      "routings": null
    },
    {
      "provider": "vertex",
      "region": "europe-west1",
      "routings": null
    },
    {
      "provider": "vertex",
      "region": "europe-west2",
      "routings": null
    },
    {
      "provider": "vertex",
      "region": "europe-west3",
      "routings": null
    },
    {
      "provider": "vertex",
      "region": "europe-west4",
      "routings": null
    },
    {
      "provider": "vertex",
      "region": "europe-west8",
      "routings": null
    },
    {
      "provider": "vertex",
      "region": "europe-west9",
      "routings": null
    },
    {
      "provider": "vertex",
      "region": "northamerica-northeast1",
      "routings": null
    },
    {
      "provider": "vertex",
      "region": "southamerica-east1",
      "routings": null
    },
    {
      "provider": "vertex",
      "region": "us-central1",
      "routings": null
    },
    {
      "provider": "vertex",
      "region": "us-east1",
      "routings": null
    },
    {
      "provider": "vertex",
      "region": "us-east4",
      "routings": null
    },
    {
      "provider": "vertex",
      "region": "us-east5",
      "routings": null
    },
    {
      "provider": "vertex",
      "region": "us-south1",
      "routings": null
    },
    {
      "provider": "vertex",
      "region": "us-west1",
      "routings": null
    },
    {
      "provider": "vertex",
      "region": "us-west4",
      "routings": null
    },
    {
      "provider": "fake",
      "region": "",
      "routings": null
    },
    {
      "provider": "fake-dev",
      "region": "",
      "routings": null
    }
  ],
  "prices": [
    {
      "model": "claude-fable-5-1",
      "provider": "anthropic",
      "region": "",
      "routing": null,
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-mythos-5-1",
      "provider": "anthropic",
      "region": "",
      "routing": null,
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "anthropic",
      "region": "",
      "routing": null,
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-mythos-5",
      "provider": "anthropic",
      "region": "",
      "routing": null,
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "anthropic",
      "region": "",
      "routing": null,
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "anthropic",
      "region": "",
      "routing": null,
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "anthropic",
      "region": "",
      "routing": null,
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "anthropic",
      "region": "",
      "routing": null,
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "anthropic",
      "region": "",
      "routing": null,
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "anthropic",
      "region": "",
      "routing": null,
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "anthropic",
      "region": "",
      "routing": null,
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.1,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "anthropic",
      "region": "",
      "routing": null,
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "anthropic",
      "region": "",
      "routing": null,
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "anthropic",
      "region": "",
      "routing": null,
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "anthropic",
      "region": "",
      "routing": null,
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "anthropic",
      "region": "",
      "routing": null,
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "af-south-1",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "ap-east-2",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "ap-northeast-1",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "ap-northeast-2",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "ap-northeast-3",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "ap-south-1",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "ap-south-2",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "ap-southeast-1",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "ap-southeast-2",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "ap-southeast-3",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "ap-southeast-4",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "ap-southeast-5",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "ap-southeast-6",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "ap-southeast-7",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "ca-central-1",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "ca-central-1",
      "routing": "geographic",
      "price": {
        "input": 11,
        "output": 55,
        "cacheRead": 0.275,
        "cacheWrite": 13.75
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "ca-west-1",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "ca-west-1",
      "routing": "geographic",
      "price": {
        "input": 11,
        "output": 55,
        "cacheRead": 0.275,
        "cacheWrite": 13.75
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "eu-central-1",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "eu-central-2",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "eu-north-1",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "eu-south-1",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "eu-south-2",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "eu-west-1",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "eu-west-2",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "eu-west-3",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "il-central-1",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "me-central-1",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "me-south-1",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "mx-central-1",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "sa-east-1",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "us-east-1",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "us-east-1",
      "routing": "geographic",
      "price": {
        "input": 11,
        "output": 55,
        "cacheRead": 0.275,
        "cacheWrite": 13.75
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "us-east-2",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "us-east-2",
      "routing": "geographic",
      "price": {
        "input": 11,
        "output": 55,
        "cacheRead": 0.275,
        "cacheWrite": 13.75
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "us-west-1",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "us-west-1",
      "routing": "geographic",
      "price": {
        "input": 11,
        "output": 55,
        "cacheRead": 0.275,
        "cacheWrite": 13.75
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "geographic",
      "price": {
        "input": 11,
        "output": 55,
        "cacheRead": 0.275,
        "cacheWrite": 13.75
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "af-south-1",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "ap-east-2",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "ap-northeast-1",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "ap-northeast-2",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "ap-northeast-3",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "ap-south-1",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "ap-south-2",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "ap-southeast-1",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "ap-southeast-2",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "ap-southeast-3",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "ap-southeast-4",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "ap-southeast-5",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "ap-southeast-6",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "ap-southeast-7",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "ca-central-1",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "ca-central-1",
      "routing": "geographic",
      "price": {
        "input": 11,
        "output": 55,
        "cacheRead": 1.1,
        "cacheWrite": 13.75
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "ca-west-1",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "ca-west-1",
      "routing": "geographic",
      "price": {
        "input": 11,
        "output": 55,
        "cacheRead": 1.1,
        "cacheWrite": 13.75
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "eu-central-1",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "eu-central-2",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "eu-north-1",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "eu-south-1",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "eu-south-2",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "eu-west-1",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "eu-west-2",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "eu-west-3",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "il-central-1",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "me-central-1",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "me-south-1",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "mx-central-1",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "sa-east-1",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "us-east-1",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "us-east-1",
      "routing": "geographic",
      "price": {
        "input": 11,
        "output": 55,
        "cacheRead": 1.1,
        "cacheWrite": 13.75
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "us-east-2",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "us-east-2",
      "routing": "geographic",
      "price": {
        "input": 11,
        "output": 55,
        "cacheRead": 1.1,
        "cacheWrite": 13.75
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "us-west-1",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "us-west-1",
      "routing": "geographic",
      "price": {
        "input": 11,
        "output": 55,
        "cacheRead": 1.1,
        "cacheWrite": 13.75
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "global",
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "geographic",
      "price": {
        "input": 11,
        "output": 55,
        "cacheRead": 1.1,
        "cacheWrite": 13.75
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "af-south-1",
      "routing": "global",
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "ap-east-2",
      "routing": "global",
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "ap-northeast-1",
      "routing": "global",
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "ap-northeast-1",
      "routing": "geographic",
      "price": {
        "input": 4.4,
        "output": 22,
        "cacheRead": 0.22,
        "cacheWrite": 5.5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "ap-northeast-2",
      "routing": "global",
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "ap-northeast-3",
      "routing": "global",
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "ap-northeast-3",
      "routing": "geographic",
      "price": {
        "input": 4.4,
        "output": 22,
        "cacheRead": 0.22,
        "cacheWrite": 5.5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "ap-south-1",
      "routing": "global",
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "ap-south-2",
      "routing": "global",
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "ap-southeast-1",
      "routing": "global",
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "ap-southeast-2",
      "routing": "global",
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "ap-southeast-2",
      "routing": "geographic",
      "price": {
        "input": 4.4,
        "output": 22,
        "cacheRead": 0.22,
        "cacheWrite": 5.5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "ap-southeast-3",
      "routing": "global",
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "ap-southeast-4",
      "routing": "global",
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "ap-southeast-4",
      "routing": "geographic",
      "price": {
        "input": 4.4,
        "output": 22,
        "cacheRead": 0.22,
        "cacheWrite": 5.5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "ap-southeast-5",
      "routing": "global",
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "ap-southeast-6",
      "routing": "global",
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "ap-southeast-7",
      "routing": "global",
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "ca-central-1",
      "routing": "global",
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "ca-central-1",
      "routing": "geographic",
      "price": {
        "input": 4.4,
        "output": 22,
        "cacheRead": 0.22,
        "cacheWrite": 5.5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "ca-west-1",
      "routing": "global",
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "ca-west-1",
      "routing": "geographic",
      "price": {
        "input": 4.4,
        "output": 22,
        "cacheRead": 0.22,
        "cacheWrite": 5.5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "eu-central-1",
      "routing": "global",
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "eu-central-1",
      "routing": "geographic",
      "price": {
        "input": 4.4,
        "output": 22,
        "cacheRead": 0.22,
        "cacheWrite": 5.5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "eu-central-2",
      "routing": "global",
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "eu-central-2",
      "routing": "geographic",
      "price": {
        "input": 4.4,
        "output": 22,
        "cacheRead": 0.22,
        "cacheWrite": 5.5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "eu-north-1",
      "routing": "global",
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "eu-north-1",
      "routing": "geographic",
      "price": {
        "input": 4.4,
        "output": 22,
        "cacheRead": 0.22,
        "cacheWrite": 5.5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "eu-south-1",
      "routing": "global",
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "eu-south-1",
      "routing": "geographic",
      "price": {
        "input": 4.4,
        "output": 22,
        "cacheRead": 0.22,
        "cacheWrite": 5.5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "eu-south-2",
      "routing": "global",
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "eu-south-2",
      "routing": "geographic",
      "price": {
        "input": 4.4,
        "output": 22,
        "cacheRead": 0.22,
        "cacheWrite": 5.5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "eu-west-1",
      "routing": "global",
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "eu-west-1",
      "routing": "geographic",
      "price": {
        "input": 4.4,
        "output": 22,
        "cacheRead": 0.22,
        "cacheWrite": 5.5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "eu-west-2",
      "routing": "global",
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "eu-west-2",
      "routing": "geographic",
      "price": {
        "input": 4.4,
        "output": 22,
        "cacheRead": 0.22,
        "cacheWrite": 5.5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "eu-west-2",
      "routing": "in-region",
      "price": {
        "input": 4.4,
        "output": 22,
        "cacheRead": 0.22,
        "cacheWrite": 5.5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "eu-west-3",
      "routing": "global",
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "eu-west-3",
      "routing": "geographic",
      "price": {
        "input": 4.4,
        "output": 22,
        "cacheRead": 0.22,
        "cacheWrite": 5.5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "il-central-1",
      "routing": "global",
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "me-central-1",
      "routing": "global",
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "me-south-1",
      "routing": "global",
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "mx-central-1",
      "routing": "global",
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "sa-east-1",
      "routing": "global",
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "us-east-1",
      "routing": "global",
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "us-east-1",
      "routing": "geographic",
      "price": {
        "input": 4.4,
        "output": 22,
        "cacheRead": 0.22,
        "cacheWrite": 5.5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "us-east-2",
      "routing": "global",
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "us-east-2",
      "routing": "geographic",
      "price": {
        "input": 4.4,
        "output": 22,
        "cacheRead": 0.22,
        "cacheWrite": 5.5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "us-west-1",
      "routing": "global",
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "us-west-1",
      "routing": "geographic",
      "price": {
        "input": 4.4,
        "output": 22,
        "cacheRead": 0.22,
        "cacheWrite": 5.5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "global",
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "geographic",
      "price": {
        "input": 4.4,
        "output": 22,
        "cacheRead": 0.22,
        "cacheWrite": 5.5
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "af-south-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "ap-east-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "ap-northeast-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "ap-northeast-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "ap-northeast-2",
      "routing": "in-region",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "ap-northeast-3",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "ap-south-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "ap-south-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "ap-south-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "ap-south-2",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "ap-southeast-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "ap-southeast-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "ap-southeast-2",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "ap-southeast-3",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "ap-southeast-4",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "ap-southeast-4",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "ap-southeast-5",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "ap-southeast-6",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "ap-southeast-7",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "ca-central-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "ca-central-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "ca-west-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "ca-west-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "eu-central-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "eu-central-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "eu-central-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "eu-central-2",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "eu-north-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "eu-north-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "eu-south-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "eu-south-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "eu-south-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "eu-south-2",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "eu-west-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "eu-west-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "eu-west-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "eu-west-2",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "eu-west-3",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "eu-west-3",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "il-central-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "me-central-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "me-south-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "mx-central-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "sa-east-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "us-east-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "us-east-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "us-east-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "us-east-2",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "us-west-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "us-west-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "af-south-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "ap-east-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "ap-northeast-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "ap-northeast-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "ap-northeast-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "ap-northeast-3",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "ap-northeast-3",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "ap-south-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "ap-south-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "ap-southeast-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "ap-southeast-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "ap-southeast-2",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "ap-southeast-3",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "ap-southeast-4",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "ap-southeast-4",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "ap-southeast-5",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "ap-southeast-6",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "ap-southeast-7",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "ca-central-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "ca-central-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "ca-west-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "ca-west-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "eu-central-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "eu-central-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "eu-central-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "eu-central-2",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "eu-north-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "eu-north-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "eu-south-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "eu-south-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "eu-south-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "eu-south-2",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "eu-west-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "eu-west-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "eu-west-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "eu-west-2",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "eu-west-3",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "eu-west-3",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "il-central-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "me-central-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "me-south-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "mx-central-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "sa-east-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "us-east-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "us-east-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "us-east-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "us-east-2",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "us-west-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "us-west-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "af-south-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "ap-east-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "ap-northeast-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "ap-northeast-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "ap-northeast-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "ap-northeast-3",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "ap-northeast-3",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "ap-south-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "ap-south-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "ap-southeast-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "ap-southeast-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "ap-southeast-2",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "ap-southeast-3",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "ap-southeast-4",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "ap-southeast-4",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "ap-southeast-5",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "ap-southeast-6",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "ap-southeast-7",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "ca-central-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "ca-central-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "ca-west-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "ca-west-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "eu-central-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "eu-central-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "eu-central-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "eu-central-2",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "eu-north-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "eu-north-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "eu-south-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "eu-south-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "eu-south-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "eu-south-2",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "eu-west-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "eu-west-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "eu-west-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "eu-west-2",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "eu-west-3",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "eu-west-3",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "il-central-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "me-central-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "me-south-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "mx-central-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "sa-east-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "us-east-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "us-east-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "us-east-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "us-east-2",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "us-west-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "us-west-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "af-south-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "ap-east-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "ap-northeast-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "ap-northeast-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "ap-northeast-3",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "ap-south-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "ap-south-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "ap-southeast-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "ap-southeast-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "ap-southeast-2",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "ap-southeast-3",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "ap-southeast-4",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "ap-southeast-4",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "ap-southeast-5",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "ap-southeast-6",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "ap-southeast-6",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "ap-southeast-7",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "ca-central-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "ca-central-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "ca-west-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "ca-west-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "eu-central-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "eu-central-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "eu-central-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "eu-central-2",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "eu-north-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "eu-north-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "eu-south-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "eu-south-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "eu-south-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "eu-south-2",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "eu-west-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "eu-west-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "eu-west-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "eu-west-2",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "eu-west-2",
      "routing": "in-region",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "eu-west-3",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "eu-west-3",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "il-central-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "me-central-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "me-south-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "mx-central-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "sa-east-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "us-east-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "us-east-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "us-east-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "us-east-2",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "us-west-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "us-west-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "af-south-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "ap-east-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "ap-northeast-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "ap-south-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "ap-south-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "ap-southeast-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "ap-southeast-3",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "ap-southeast-6",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "ap-southeast-7",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "ca-central-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "ca-central-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "eu-central-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "eu-central-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "eu-north-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "eu-north-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "eu-south-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "eu-south-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "eu-south-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "eu-south-2",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "eu-west-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "eu-west-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "eu-west-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "eu-west-3",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "eu-west-3",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "il-central-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "me-central-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "me-south-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "mx-central-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "sa-east-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "us-east-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "us-east-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "us-east-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "us-east-2",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "us-west-1",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "us-west-1",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "global",
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "geographic",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-1",
      "provider": "bedrock",
      "region": "us-east-1",
      "routing": "geographic",
      "price": {
        "input": 15,
        "output": 75,
        "cacheRead": 1.5,
        "cacheWrite": 18.75
      }
    },
    {
      "model": "claude-opus-4-1",
      "provider": "bedrock",
      "region": "us-east-2",
      "routing": "geographic",
      "price": {
        "input": 15,
        "output": 75,
        "cacheRead": 1.5,
        "cacheWrite": 18.75
      }
    },
    {
      "model": "claude-opus-4-1",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "geographic",
      "price": {
        "input": 15,
        "output": 75,
        "cacheRead": 1.5,
        "cacheWrite": 18.75
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "af-south-1",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.1,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "ap-east-2",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.1,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "ap-northeast-2",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.1,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "ap-south-1",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.1,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "ap-south-2",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.1,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "ap-southeast-1",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.1,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "ap-southeast-2",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.1,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "ap-southeast-2",
      "routing": "geographic",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.11,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "ap-southeast-3",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.1,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "ap-southeast-4",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.1,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "ap-southeast-4",
      "routing": "geographic",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.11,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "ap-southeast-5",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.1,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "ap-southeast-6",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.1,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "ap-southeast-7",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.1,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "ca-central-1",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.1,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "ca-central-1",
      "routing": "geographic",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.11,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "ca-west-1",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.1,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "ca-west-1",
      "routing": "geographic",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.11,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "eu-central-1",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.1,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "eu-central-1",
      "routing": "geographic",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.11,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "eu-central-2",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.1,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "eu-central-2",
      "routing": "geographic",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.11,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "eu-north-1",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.1,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "eu-north-1",
      "routing": "geographic",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.11,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "eu-south-1",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.1,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "eu-south-1",
      "routing": "geographic",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.11,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "eu-south-2",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.1,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "eu-south-2",
      "routing": "geographic",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.11,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "eu-west-1",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.1,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "eu-west-1",
      "routing": "geographic",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.11,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "eu-west-2",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.1,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "eu-west-2",
      "routing": "geographic",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.11,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "eu-west-3",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.1,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "eu-west-3",
      "routing": "geographic",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.11,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "il-central-1",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.1,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "me-central-1",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.1,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "me-south-1",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.1,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "mx-central-1",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.1,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "sa-east-1",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.1,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "us-east-1",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.1,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "us-east-1",
      "routing": "geographic",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.11,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "us-east-2",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.1,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "us-east-2",
      "routing": "geographic",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.11,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "us-west-1",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.1,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "us-west-1",
      "routing": "geographic",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.11,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.1,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "geographic",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.11,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "af-south-1",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "ap-east-2",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "ap-northeast-1",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "ap-northeast-2",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "ap-northeast-2",
      "routing": "in-region",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.22,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "ap-northeast-3",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "ap-south-1",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "ap-south-1",
      "routing": "geographic",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.22,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "ap-south-2",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "ap-south-2",
      "routing": "geographic",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.22,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "ap-southeast-1",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "ap-southeast-1",
      "routing": "in-region",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.22,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "ap-southeast-2",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "ap-southeast-2",
      "routing": "geographic",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.22,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "ap-southeast-3",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "ap-southeast-4",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "ap-southeast-4",
      "routing": "geographic",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.22,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "ap-southeast-5",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "ap-southeast-6",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "ap-southeast-7",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "ca-central-1",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "ca-central-1",
      "routing": "geographic",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.22,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "ca-west-1",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "ca-west-1",
      "routing": "geographic",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.22,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "eu-central-1",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "eu-central-1",
      "routing": "geographic",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.22,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "eu-central-2",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "eu-central-2",
      "routing": "geographic",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.22,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "eu-north-1",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "eu-north-1",
      "routing": "geographic",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.22,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "eu-south-1",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "eu-south-1",
      "routing": "geographic",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.22,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "eu-south-2",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "eu-south-2",
      "routing": "geographic",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.22,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "eu-west-1",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "eu-west-1",
      "routing": "geographic",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.22,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "eu-west-2",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "eu-west-2",
      "routing": "geographic",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.22,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "eu-west-2",
      "routing": "in-region",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.22,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "eu-west-3",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "eu-west-3",
      "routing": "geographic",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.22,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "il-central-1",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "me-central-1",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "me-south-1",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "mx-central-1",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "sa-east-1",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "us-east-1",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "us-east-1",
      "routing": "geographic",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.22,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "us-east-2",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "us-east-2",
      "routing": "geographic",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.22,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "us-west-1",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "us-west-1",
      "routing": "geographic",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.22,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "global",
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "geographic",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.22,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "af-south-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "ap-east-2",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "ap-northeast-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "ap-northeast-1",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "ap-northeast-2",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "ap-northeast-3",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "ap-northeast-3",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "ap-south-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "ap-south-2",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "ap-southeast-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "ap-southeast-2",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "ap-southeast-2",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "ap-southeast-3",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "ap-southeast-4",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "ap-southeast-4",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "ap-southeast-5",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "ap-southeast-6",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "ap-southeast-6",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "ap-southeast-7",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "ca-central-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "ca-central-1",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "ca-west-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "ca-west-1",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "eu-central-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "eu-central-1",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "eu-central-2",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "eu-central-2",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "eu-north-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "eu-north-1",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "eu-south-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "eu-south-1",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "eu-south-2",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "eu-south-2",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "eu-west-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "eu-west-1",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "eu-west-2",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "eu-west-2",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "eu-west-2",
      "routing": "in-region",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "eu-west-3",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "eu-west-3",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "il-central-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "me-central-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "me-south-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "mx-central-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "sa-east-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "us-east-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "us-east-1",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "us-east-2",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "us-east-2",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "us-west-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "us-west-1",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "af-south-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "ap-east-2",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "ap-northeast-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "ap-northeast-1",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "ap-northeast-2",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "ap-northeast-3",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "ap-northeast-3",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "ap-south-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "ap-south-2",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "ap-southeast-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "ap-southeast-2",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "ap-southeast-2",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "ap-southeast-3",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "ap-southeast-4",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "ap-southeast-4",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "ap-southeast-5",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "ap-southeast-6",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "ap-southeast-6",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "ap-southeast-7",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "ca-central-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "ca-central-1",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "eu-central-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "eu-central-1",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "eu-central-2",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "eu-central-2",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "eu-north-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "eu-north-1",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "eu-south-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "eu-south-1",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "eu-south-2",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "eu-south-2",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "eu-west-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "eu-west-1",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "eu-west-2",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "eu-west-2",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "eu-west-3",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "eu-west-3",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "il-central-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "me-central-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "me-south-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "mx-central-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "sa-east-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "us-east-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "us-east-1",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "us-east-2",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "us-east-2",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "us-gov-east-1",
      "routing": "geographic",
      "price": {
        "input": 3.6,
        "output": 18,
        "cacheRead": 0.36,
        "cacheWrite": 4.5
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "us-gov-west-1",
      "routing": "geographic",
      "price": {
        "input": 3.6,
        "output": 18,
        "cacheRead": 0.36,
        "cacheWrite": 4.5
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "us-west-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "us-west-1",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "geographic",
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.125
      }
    },
    {
      "model": "claude-sonnet-4",
      "provider": "bedrock",
      "region": "ap-northeast-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4",
      "provider": "bedrock",
      "region": "ap-northeast-2",
      "routing": "geographic",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4",
      "provider": "bedrock",
      "region": "ap-southeast-1",
      "routing": "geographic",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4",
      "provider": "bedrock",
      "region": "eu-central-1",
      "routing": "geographic",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4",
      "provider": "bedrock",
      "region": "eu-north-1",
      "routing": "geographic",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4",
      "provider": "bedrock",
      "region": "eu-south-1",
      "routing": "geographic",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4",
      "provider": "bedrock",
      "region": "eu-south-2",
      "routing": "geographic",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4",
      "provider": "bedrock",
      "region": "eu-west-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4",
      "provider": "bedrock",
      "region": "eu-west-1",
      "routing": "geographic",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4",
      "provider": "bedrock",
      "region": "eu-west-3",
      "routing": "geographic",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4",
      "provider": "bedrock",
      "region": "il-central-1",
      "routing": "geographic",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4",
      "provider": "bedrock",
      "region": "us-east-1",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4",
      "provider": "bedrock",
      "region": "us-east-1",
      "routing": "geographic",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4",
      "provider": "bedrock",
      "region": "us-east-2",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4",
      "provider": "bedrock",
      "region": "us-east-2",
      "routing": "geographic",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4",
      "provider": "bedrock",
      "region": "us-west-1",
      "routing": "geographic",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "global",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "geographic",
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "af-south-1",
      "routing": "global",
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "ap-east-2",
      "routing": "global",
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "ap-northeast-1",
      "routing": "global",
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "ap-northeast-1",
      "routing": "geographic",
      "price": {
        "input": 0.11,
        "output": 0.55,
        "cacheRead": 0.011,
        "cacheWrite": 0.1375
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "ap-northeast-2",
      "routing": "global",
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "ap-northeast-3",
      "routing": "global",
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "ap-northeast-3",
      "routing": "geographic",
      "price": {
        "input": 0.11,
        "output": 0.55,
        "cacheRead": 0.011,
        "cacheWrite": 0.1375
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "ap-south-1",
      "routing": "global",
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "ap-south-2",
      "routing": "global",
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "ap-southeast-1",
      "routing": "global",
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "ap-southeast-2",
      "routing": "global",
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "ap-southeast-2",
      "routing": "geographic",
      "price": {
        "input": 0.11,
        "output": 0.55,
        "cacheRead": 0.011,
        "cacheWrite": 0.1375
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "ap-southeast-3",
      "routing": "global",
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "ap-southeast-4",
      "routing": "global",
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "ap-southeast-4",
      "routing": "geographic",
      "price": {
        "input": 0.11,
        "output": 0.55,
        "cacheRead": 0.011,
        "cacheWrite": 0.1375
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "ap-southeast-5",
      "routing": "global",
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "ap-southeast-6",
      "routing": "global",
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "ap-southeast-7",
      "routing": "global",
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "ca-central-1",
      "routing": "global",
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "ca-central-1",
      "routing": "geographic",
      "price": {
        "input": 0.11,
        "output": 0.55,
        "cacheRead": 0.011,
        "cacheWrite": 0.1375
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "ca-west-1",
      "routing": "global",
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "ca-west-1",
      "routing": "geographic",
      "price": {
        "input": 0.11,
        "output": 0.55,
        "cacheRead": 0.011,
        "cacheWrite": 0.1375
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "eu-central-1",
      "routing": "global",
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "eu-central-1",
      "routing": "geographic",
      "price": {
        "input": 0.11,
        "output": 0.55,
        "cacheRead": 0.011,
        "cacheWrite": 0.1375
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "eu-central-2",
      "routing": "global",
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "eu-central-2",
      "routing": "geographic",
      "price": {
        "input": 0.11,
        "output": 0.55,
        "cacheRead": 0.011,
        "cacheWrite": 0.1375
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "eu-north-1",
      "routing": "global",
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "eu-north-1",
      "routing": "geographic",
      "price": {
        "input": 0.11,
        "output": 0.55,
        "cacheRead": 0.011,
        "cacheWrite": 0.1375
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "eu-south-1",
      "routing": "global",
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "eu-south-1",
      "routing": "geographic",
      "price": {
        "input": 0.11,
        "output": 0.55,
        "cacheRead": 0.011,
        "cacheWrite": 0.1375
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "eu-south-2",
      "routing": "global",
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "eu-south-2",
      "routing": "geographic",
      "price": {
        "input": 0.11,
        "output": 0.55,
        "cacheRead": 0.011,
        "cacheWrite": 0.1375
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "eu-west-1",
      "routing": "global",
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "eu-west-1",
      "routing": "geographic",
      "price": {
        "input": 0.11,
        "output": 0.55,
        "cacheRead": 0.011,
        "cacheWrite": 0.1375
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "eu-west-2",
      "routing": "global",
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "eu-west-2",
      "routing": "geographic",
      "price": {
        "input": 0.11,
        "output": 0.55,
        "cacheRead": 0.011,
        "cacheWrite": 0.1375
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "eu-west-3",
      "routing": "global",
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "eu-west-3",
      "routing": "geographic",
      "price": {
        "input": 0.11,
        "output": 0.55,
        "cacheRead": 0.011,
        "cacheWrite": 0.1375
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "il-central-1",
      "routing": "global",
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "me-central-1",
      "routing": "global",
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "me-south-1",
      "routing": "global",
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "mx-central-1",
      "routing": "global",
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "sa-east-1",
      "routing": "global",
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "us-east-1",
      "routing": "global",
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "us-east-1",
      "routing": "geographic",
      "price": {
        "input": 0.11,
        "output": 0.55,
        "cacheRead": 0.011,
        "cacheWrite": 0.1375
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "us-east-2",
      "routing": "global",
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "us-east-2",
      "routing": "geographic",
      "price": {
        "input": 0.11,
        "output": 0.55,
        "cacheRead": 0.011,
        "cacheWrite": 0.1375
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "us-west-1",
      "routing": "global",
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "us-west-1",
      "routing": "geographic",
      "price": {
        "input": 0.11,
        "output": 0.55,
        "cacheRead": 0.011,
        "cacheWrite": 0.1375
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "global",
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "geographic",
      "price": {
        "input": 0.11,
        "output": 0.55,
        "cacheRead": 0.011,
        "cacheWrite": 0.1375
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "af-south-1",
      "routing": "global",
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "ap-east-2",
      "routing": "global",
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "ap-northeast-1",
      "routing": "global",
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "ap-northeast-1",
      "routing": "geographic",
      "price": {
        "input": 1.1,
        "output": 5.5,
        "cacheRead": 0.11,
        "cacheWrite": 1.375
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "ap-northeast-2",
      "routing": "global",
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "ap-northeast-3",
      "routing": "global",
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "ap-northeast-3",
      "routing": "geographic",
      "price": {
        "input": 1.1,
        "output": 5.5,
        "cacheRead": 0.11,
        "cacheWrite": 1.375
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "ap-south-1",
      "routing": "global",
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "ap-south-1",
      "routing": "geographic",
      "price": {
        "input": 1.1,
        "output": 5.5,
        "cacheRead": 0.11,
        "cacheWrite": 1.375
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "ap-south-2",
      "routing": "global",
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "ap-south-2",
      "routing": "geographic",
      "price": {
        "input": 1.1,
        "output": 5.5,
        "cacheRead": 0.11,
        "cacheWrite": 1.375
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "ap-southeast-1",
      "routing": "global",
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "ap-southeast-2",
      "routing": "global",
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "ap-southeast-2",
      "routing": "geographic",
      "price": {
        "input": 1.1,
        "output": 5.5,
        "cacheRead": 0.11,
        "cacheWrite": 1.375
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "ap-southeast-3",
      "routing": "global",
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "ap-southeast-4",
      "routing": "global",
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "ap-southeast-4",
      "routing": "geographic",
      "price": {
        "input": 1.1,
        "output": 5.5,
        "cacheRead": 0.11,
        "cacheWrite": 1.375
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "ap-southeast-5",
      "routing": "global",
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "ap-southeast-6",
      "routing": "global",
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "ap-southeast-6",
      "routing": "geographic",
      "price": {
        "input": 1.1,
        "output": 5.5,
        "cacheRead": 0.11,
        "cacheWrite": 1.375
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "ap-southeast-7",
      "routing": "global",
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "ca-central-1",
      "routing": "global",
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "ca-central-1",
      "routing": "geographic",
      "price": {
        "input": 1.1,
        "output": 5.5,
        "cacheRead": 0.11,
        "cacheWrite": 1.375
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "ca-west-1",
      "routing": "global",
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "eu-central-1",
      "routing": "global",
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "eu-central-1",
      "routing": "geographic",
      "price": {
        "input": 1.1,
        "output": 5.5,
        "cacheRead": 0.11,
        "cacheWrite": 1.375
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "eu-central-2",
      "routing": "global",
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "eu-central-2",
      "routing": "geographic",
      "price": {
        "input": 1.1,
        "output": 5.5,
        "cacheRead": 0.11,
        "cacheWrite": 1.375
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "eu-north-1",
      "routing": "global",
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "eu-north-1",
      "routing": "geographic",
      "price": {
        "input": 1.1,
        "output": 5.5,
        "cacheRead": 0.11,
        "cacheWrite": 1.375
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "eu-south-1",
      "routing": "global",
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "eu-south-1",
      "routing": "geographic",
      "price": {
        "input": 1.1,
        "output": 5.5,
        "cacheRead": 0.11,
        "cacheWrite": 1.375
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "eu-south-2",
      "routing": "global",
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "eu-south-2",
      "routing": "geographic",
      "price": {
        "input": 1.1,
        "output": 5.5,
        "cacheRead": 0.11,
        "cacheWrite": 1.375
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "eu-west-1",
      "routing": "global",
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "eu-west-1",
      "routing": "geographic",
      "price": {
        "input": 1.1,
        "output": 5.5,
        "cacheRead": 0.11,
        "cacheWrite": 1.375
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "eu-west-2",
      "routing": "global",
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "eu-west-2",
      "routing": "geographic",
      "price": {
        "input": 1.1,
        "output": 5.5,
        "cacheRead": 0.11,
        "cacheWrite": 1.375
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "eu-west-3",
      "routing": "global",
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "eu-west-3",
      "routing": "geographic",
      "price": {
        "input": 1.1,
        "output": 5.5,
        "cacheRead": 0.11,
        "cacheWrite": 1.375
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "il-central-1",
      "routing": "global",
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "me-central-1",
      "routing": "global",
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "me-south-1",
      "routing": "global",
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "mx-central-1",
      "routing": "global",
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "sa-east-1",
      "routing": "global",
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "us-east-1",
      "routing": "global",
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "us-east-1",
      "routing": "geographic",
      "price": {
        "input": 1.1,
        "output": 5.5,
        "cacheRead": 0.11,
        "cacheWrite": 1.375
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "us-east-2",
      "routing": "global",
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "us-east-2",
      "routing": "geographic",
      "price": {
        "input": 1.1,
        "output": 5.5,
        "cacheRead": 0.11,
        "cacheWrite": 1.375
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "us-west-1",
      "routing": "global",
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "us-west-1",
      "routing": "geographic",
      "price": {
        "input": 1.1,
        "output": 5.5,
        "cacheRead": 0.11,
        "cacheWrite": 1.375
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "global",
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "geographic",
      "price": {
        "input": 1.1,
        "output": 5.5,
        "cacheRead": 0.11,
        "cacheWrite": 1.375
      }
    },
    {
      "model": "gemini-4-argon",
      "provider": "ai-studio",
      "region": "",
      "routing": null,
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.1,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-8-flash",
      "provider": "ai-studio",
      "region": "",
      "routing": null,
      "price": {
        "input": 0.75,
        "output": 3.75,
        "cacheRead": 0.075,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-6-flash",
      "provider": "ai-studio",
      "region": "",
      "routing": null,
      "price": {
        "input": 0.75,
        "output": 3.75,
        "cacheRead": 0.075,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-5-flash-lite",
      "provider": "ai-studio",
      "region": "",
      "routing": null,
      "price": {
        "input": 0.3,
        "output": 2.5,
        "cacheRead": 0.03,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-1-flash-lite",
      "provider": "ai-studio",
      "region": "",
      "routing": null,
      "price": {
        "input": 0.25,
        "output": 1.5,
        "cacheRead": 0.025,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-1-pro-preview",
      "provider": "ai-studio",
      "region": "",
      "routing": null,
      "price": {
        "input": 2,
        "output": 12,
        "cacheRead": 0.2,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-flash-preview",
      "provider": "ai-studio",
      "region": "",
      "routing": null,
      "price": {
        "input": 0.5,
        "output": 3,
        "cacheRead": 0.05,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-pro",
      "provider": "ai-studio",
      "region": "",
      "routing": null,
      "price": {
        "input": 1.25,
        "output": 10,
        "cacheRead": 0.125,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash",
      "provider": "ai-studio",
      "region": "",
      "routing": null,
      "price": {
        "input": 0.3,
        "output": 2.5,
        "cacheRead": 0.03,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash-lite",
      "provider": "ai-studio",
      "region": "",
      "routing": null,
      "price": {
        "input": 0.1,
        "output": 0.4,
        "cacheRead": 0.01,
        "cacheWrite": 0
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "vertex",
      "region": "global",
      "routing": null,
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 0.25,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "vertex",
      "region": "us",
      "routing": null,
      "price": {
        "input": 11,
        "output": 55,
        "cacheRead": 0.275,
        "cacheWrite": 13.75
      }
    },
    {
      "model": "claude-fable-5-1",
      "provider": "vertex",
      "region": "eu",
      "routing": null,
      "price": {
        "input": 11,
        "output": 55,
        "cacheRead": 0.275,
        "cacheWrite": 13.75
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "vertex",
      "region": "global",
      "routing": null,
      "price": {
        "input": 10,
        "output": 50,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    },
    {
      "model": "claude-fable-5",
      "provider": "vertex",
      "region": "eu",
      "routing": null,
      "price": {
        "input": 11,
        "output": 55,
        "cacheRead": 1.1,
        "cacheWrite": 13.75
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "vertex",
      "region": "global",
      "routing": null,
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 5
      }
    },
    {
      "model": "claude-opus-5-5",
      "provider": "vertex",
      "region": "eu",
      "routing": null,
      "price": {
        "input": 4.4,
        "output": 22,
        "cacheRead": 0.22,
        "cacheWrite": 5.5
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "vertex",
      "region": "global",
      "routing": null,
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "vertex",
      "region": "us",
      "routing": null,
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-5",
      "provider": "vertex",
      "region": "eu",
      "routing": null,
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "vertex",
      "region": "global",
      "routing": null,
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "vertex",
      "region": "us",
      "routing": null,
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-8",
      "provider": "vertex",
      "region": "eu",
      "routing": null,
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "vertex",
      "region": "global",
      "routing": null,
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "vertex",
      "region": "us",
      "routing": null,
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-7",
      "provider": "vertex",
      "region": "eu",
      "routing": null,
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "vertex",
      "region": "global",
      "routing": null,
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "vertex",
      "region": "us-east5",
      "routing": null,
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "vertex",
      "region": "europe-west1",
      "routing": null,
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-6",
      "provider": "vertex",
      "region": "asia-southeast1",
      "routing": null,
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "vertex",
      "region": "global",
      "routing": null,
      "price": {
        "input": 5,
        "output": 25,
        "cacheRead": 0.5,
        "cacheWrite": 6.25
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "vertex",
      "region": "us-east5",
      "routing": null,
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "vertex",
      "region": "europe-west1",
      "routing": null,
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-opus-4-5",
      "provider": "vertex",
      "region": "asia-southeast1",
      "routing": null,
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "vertex",
      "region": "global",
      "routing": null,
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.1,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "vertex",
      "region": "us",
      "routing": null,
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.11,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "vertex",
      "region": "eu",
      "routing": null,
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.11,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "vertex",
      "region": "global",
      "routing": null,
      "price": {
        "input": 2,
        "output": 10,
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "vertex",
      "region": "us",
      "routing": null,
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.22,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5",
      "provider": "vertex",
      "region": "eu",
      "routing": null,
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.22,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "vertex",
      "region": "global",
      "routing": null,
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-6",
      "provider": "vertex",
      "region": "asia-southeast1",
      "routing": null,
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.13
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "vertex",
      "region": "global",
      "routing": null,
      "price": {
        "input": 3,
        "output": 15,
        "cacheRead": 0.3,
        "cacheWrite": 3.75
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "vertex",
      "region": "us-east5",
      "routing": null,
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.13
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "vertex",
      "region": "europe-west1",
      "routing": null,
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.13
      }
    },
    {
      "model": "claude-sonnet-4-5",
      "provider": "vertex",
      "region": "asia-southeast1",
      "routing": null,
      "price": {
        "input": 3.3,
        "output": 16.5,
        "cacheRead": 0.33,
        "cacheWrite": 4.13
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "vertex",
      "region": "global",
      "routing": null,
      "price": {
        "input": 0.1,
        "output": 0.5,
        "cacheRead": 0.01,
        "cacheWrite": 0.125
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "vertex",
      "region": "us",
      "routing": null,
      "price": {
        "input": 0.11,
        "output": 0.55,
        "cacheRead": 0.011,
        "cacheWrite": 0.1375
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "vertex",
      "region": "eu",
      "routing": null,
      "price": {
        "input": 0.11,
        "output": 0.55,
        "cacheRead": 0.011,
        "cacheWrite": 0.1375
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "vertex",
      "region": "europe-west1",
      "routing": null,
      "price": {
        "input": 0.11,
        "output": 0.55,
        "cacheRead": 0.011,
        "cacheWrite": 0.1375
      }
    },
    {
      "model": "claude-haiku-5-5",
      "provider": "vertex",
      "region": "asia-southeast1",
      "routing": null,
      "price": {
        "input": 0.11,
        "output": 0.55,
        "cacheRead": 0.011,
        "cacheWrite": 0.1375
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "vertex",
      "region": "global",
      "routing": null,
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "vertex",
      "region": "us-east5",
      "routing": null,
      "price": {
        "input": 1.1,
        "output": 5.5,
        "cacheRead": 0.11,
        "cacheWrite": 1.375
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "vertex",
      "region": "europe-west1",
      "routing": null,
      "price": {
        "input": 1.1,
        "output": 5.5,
        "cacheRead": 0.11,
        "cacheWrite": 1.375
      }
    },
    {
      "model": "claude-haiku-4-5",
      "provider": "vertex",
      "region": "asia-east1",
      "routing": null,
      "price": {
        "input": 1.1,
        "output": 5.5,
        "cacheRead": 0.11,
        "cacheWrite": 1.375
      }
    },
    {
      "model": "gemini-4-argon",
      "provider": "vertex",
      "region": "global",
      "routing": null,
      "price": {
        "input": 4,
        "output": 20,
        "cacheRead": 0.2,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-4-argon",
      "provider": "vertex",
      "region": "us",
      "routing": null,
      "price": {
        "input": 4.4,
        "output": 22,
        "cacheRead": 0.22,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-4-argon",
      "provider": "vertex",
      "region": "eu",
      "routing": null,
      "price": {
        "input": 4.4,
        "output": 22,
        "cacheRead": 0.22,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-4-argon",
      "provider": "vertex",
      "region": "europe-west2",
      "routing": null,
      "price": {
        "input": 4.4,
        "output": 22,
        "cacheRead": 0.22,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-4-argon",
      "provider": "vertex",
      "region": "asia-southeast1",
      "routing": null,
      "price": {
        "input": 4.4,
        "output": 22,
        "cacheRead": 0.22,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-8-flash",
      "provider": "vertex",
      "region": "global",
      "routing": null,
      "price": {
        "input": 1.5,
        "output": 7.5,
        "cacheRead": 0.15,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-8-flash",
      "provider": "vertex",
      "region": "us",
      "routing": null,
      "price": {
        "input": 1.65,
        "output": 8.25,
        "cacheRead": 0.165,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-8-flash",
      "provider": "vertex",
      "region": "eu",
      "routing": null,
      "price": {
        "input": 1.65,
        "output": 8.25,
        "cacheRead": 0.165,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-7-flash",
      "provider": "vertex",
      "region": "global",
      "routing": null,
      "price": {
        "input": 1.5,
        "output": 7.5,
        "cacheRead": 0.15,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-7-flash",
      "provider": "vertex",
      "region": "us",
      "routing": null,
      "price": {
        "input": 1.65,
        "output": 8.25,
        "cacheRead": 0.165,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-7-flash",
      "provider": "vertex",
      "region": "eu",
      "routing": null,
      "price": {
        "input": 1.65,
        "output": 8.25,
        "cacheRead": 0.165,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-6-flash",
      "provider": "vertex",
      "region": "global",
      "routing": null,
      "price": {
        "input": 1.5,
        "output": 7.5,
        "cacheRead": 0.15,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-6-flash",
      "provider": "vertex",
      "region": "us",
      "routing": null,
      "price": {
        "input": 1.65,
        "output": 8.25,
        "cacheRead": 0.165,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-6-flash",
      "provider": "vertex",
      "region": "eu",
      "routing": null,
      "price": {
        "input": 1.65,
        "output": 8.25,
        "cacheRead": 0.165,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-5-flash-lite",
      "provider": "vertex",
      "region": "global",
      "routing": null,
      "price": {
        "input": 0.3,
        "output": 2.5,
        "cacheRead": 0.03,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-5-flash-lite",
      "provider": "vertex",
      "region": "us",
      "routing": null,
      "price": {
        "input": 0.33,
        "output": 2.75,
        "cacheRead": 0.033,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-5-flash-lite",
      "provider": "vertex",
      "region": "eu",
      "routing": null,
      "price": {
        "input": 0.33,
        "output": 2.75,
        "cacheRead": 0.033,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-5-flash-lite",
      "provider": "vertex",
      "region": "asia-south1",
      "routing": null,
      "price": {
        "input": 0.33,
        "output": 2.75,
        "cacheRead": 0.033,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-5-flash",
      "provider": "vertex",
      "region": "global",
      "routing": null,
      "price": {
        "input": 1.5,
        "output": 9,
        "cacheRead": 0.15,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-5-flash",
      "provider": "vertex",
      "region": "us",
      "routing": null,
      "price": {
        "input": 1.65,
        "output": 9.9,
        "cacheRead": 0.165,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-5-flash",
      "provider": "vertex",
      "region": "eu",
      "routing": null,
      "price": {
        "input": 1.65,
        "output": 9.9,
        "cacheRead": 0.165,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-5-flash",
      "provider": "vertex",
      "region": "northamerica-northeast1",
      "routing": null,
      "price": {
        "input": 1.65,
        "output": 9.9,
        "cacheRead": 0.165,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-5-flash",
      "provider": "vertex",
      "region": "europe-west2",
      "routing": null,
      "price": {
        "input": 1.65,
        "output": 9.9,
        "cacheRead": 0.165,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-5-flash",
      "provider": "vertex",
      "region": "europe-west3",
      "routing": null,
      "price": {
        "input": 1.65,
        "output": 9.9,
        "cacheRead": 0.165,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-5-flash",
      "provider": "vertex",
      "region": "asia-south1",
      "routing": null,
      "price": {
        "input": 1.65,
        "output": 9.9,
        "cacheRead": 0.165,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-5-flash",
      "provider": "vertex",
      "region": "asia-southeast1",
      "routing": null,
      "price": {
        "input": 1.65,
        "output": 9.9,
        "cacheRead": 0.165,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-5-flash",
      "provider": "vertex",
      "region": "asia-northeast1",
      "routing": null,
      "price": {
        "input": 1.65,
        "output": 9.9,
        "cacheRead": 0.165,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-5-flash",
      "provider": "vertex",
      "region": "australia-southeast1",
      "routing": null,
      "price": {
        "input": 1.65,
        "output": 9.9,
        "cacheRead": 0.165,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-1-flash-lite",
      "provider": "vertex",
      "region": "global",
      "routing": null,
      "price": {
        "input": 0.25,
        "output": 1.5,
        "cacheRead": 0.025,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-1-flash-lite",
      "provider": "vertex",
      "region": "us",
      "routing": null,
      "price": {
        "input": 0.275,
        "output": 1.65,
        "cacheRead": 0.0275,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-1-flash-lite",
      "provider": "vertex",
      "region": "eu",
      "routing": null,
      "price": {
        "input": 0.275,
        "output": 1.65,
        "cacheRead": 0.0275,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-1-pro-preview",
      "provider": "vertex",
      "region": "global",
      "routing": null,
      "price": {
        "input": 2,
        "output": 12,
        "cacheRead": 0.2,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-pro",
      "provider": "vertex",
      "region": "global",
      "routing": null,
      "price": {
        "input": 1.25,
        "output": 10,
        "cacheRead": 0.125,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-pro",
      "provider": "vertex",
      "region": "us-west1",
      "routing": null,
      "price": {
        "input": 1.25,
        "output": 10,
        "cacheRead": 0.125,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-pro",
      "provider": "vertex",
      "region": "us-west4",
      "routing": null,
      "price": {
        "input": 1.25,
        "output": 10,
        "cacheRead": 0.125,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-pro",
      "provider": "vertex",
      "region": "us-central1",
      "routing": null,
      "price": {
        "input": 1.25,
        "output": 10,
        "cacheRead": 0.125,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-pro",
      "provider": "vertex",
      "region": "us-east1",
      "routing": null,
      "price": {
        "input": 1.25,
        "output": 10,
        "cacheRead": 0.125,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-pro",
      "provider": "vertex",
      "region": "us-east4",
      "routing": null,
      "price": {
        "input": 1.25,
        "output": 10,
        "cacheRead": 0.125,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-pro",
      "provider": "vertex",
      "region": "us-east5",
      "routing": null,
      "price": {
        "input": 1.25,
        "output": 10,
        "cacheRead": 0.125,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-pro",
      "provider": "vertex",
      "region": "us-south1",
      "routing": null,
      "price": {
        "input": 1.25,
        "output": 10,
        "cacheRead": 0.125,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-pro",
      "provider": "vertex",
      "region": "northamerica-northeast1",
      "routing": null,
      "price": {
        "input": 1.25,
        "output": 10,
        "cacheRead": 0.125,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-pro",
      "provider": "vertex",
      "region": "europe-west1",
      "routing": null,
      "price": {
        "input": 1.25,
        "output": 10,
        "cacheRead": 0.125,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-pro",
      "provider": "vertex",
      "region": "europe-west4",
      "routing": null,
      "price": {
        "input": 1.25,
        "output": 10,
        "cacheRead": 0.125,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-pro",
      "provider": "vertex",
      "region": "europe-north1",
      "routing": null,
      "price": {
        "input": 1.25,
        "output": 10,
        "cacheRead": 0.125,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-pro",
      "provider": "vertex",
      "region": "europe-central2",
      "routing": null,
      "price": {
        "input": 1.25,
        "output": 10,
        "cacheRead": 0.125,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-pro",
      "provider": "vertex",
      "region": "europe-west8",
      "routing": null,
      "price": {
        "input": 1.25,
        "output": 10,
        "cacheRead": 0.125,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-pro",
      "provider": "vertex",
      "region": "europe-southwest1",
      "routing": null,
      "price": {
        "input": 1.25,
        "output": 10,
        "cacheRead": 0.125,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-pro",
      "provider": "vertex",
      "region": "europe-west9",
      "routing": null,
      "price": {
        "input": 1.25,
        "output": 10,
        "cacheRead": 0.125,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-pro",
      "provider": "vertex",
      "region": "asia-northeast1",
      "routing": null,
      "price": {
        "input": 1.25,
        "output": 10,
        "cacheRead": 0.125,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash",
      "provider": "vertex",
      "region": "global",
      "routing": null,
      "price": {
        "input": 0.3,
        "output": 2.5,
        "cacheRead": 0.03,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash",
      "provider": "vertex",
      "region": "us-west1",
      "routing": null,
      "price": {
        "input": 0.3,
        "output": 2.5,
        "cacheRead": 0.03,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash",
      "provider": "vertex",
      "region": "us-west4",
      "routing": null,
      "price": {
        "input": 0.3,
        "output": 2.5,
        "cacheRead": 0.03,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash",
      "provider": "vertex",
      "region": "us-central1",
      "routing": null,
      "price": {
        "input": 0.3,
        "output": 2.5,
        "cacheRead": 0.03,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash",
      "provider": "vertex",
      "region": "us-east1",
      "routing": null,
      "price": {
        "input": 0.3,
        "output": 2.5,
        "cacheRead": 0.03,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash",
      "provider": "vertex",
      "region": "us-east4",
      "routing": null,
      "price": {
        "input": 0.3,
        "output": 2.5,
        "cacheRead": 0.03,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash",
      "provider": "vertex",
      "region": "us-east5",
      "routing": null,
      "price": {
        "input": 0.3,
        "output": 2.5,
        "cacheRead": 0.03,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash",
      "provider": "vertex",
      "region": "us-south1",
      "routing": null,
      "price": {
        "input": 0.3,
        "output": 2.5,
        "cacheRead": 0.03,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash",
      "provider": "vertex",
      "region": "northamerica-northeast1",
      "routing": null,
      "price": {
        "input": 0.3,
        "output": 2.5,
        "cacheRead": 0.03,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash",
      "provider": "vertex",
      "region": "southamerica-east1",
      "routing": null,
      "price": {
        "input": 0.3,
        "output": 2.5,
        "cacheRead": 0.03,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash",
      "provider": "vertex",
      "region": "europe-west2",
      "routing": null,
      "price": {
        "input": 0.3,
        "output": 2.5,
        "cacheRead": 0.03,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash",
      "provider": "vertex",
      "region": "europe-west1",
      "routing": null,
      "price": {
        "input": 0.3,
        "output": 2.5,
        "cacheRead": 0.03,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash",
      "provider": "vertex",
      "region": "europe-west4",
      "routing": null,
      "price": {
        "input": 0.3,
        "output": 2.5,
        "cacheRead": 0.03,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash",
      "provider": "vertex",
      "region": "europe-west3",
      "routing": null,
      "price": {
        "input": 0.3,
        "output": 2.5,
        "cacheRead": 0.03,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash",
      "provider": "vertex",
      "region": "europe-north1",
      "routing": null,
      "price": {
        "input": 0.3,
        "output": 2.5,
        "cacheRead": 0.03,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash",
      "provider": "vertex",
      "region": "europe-central2",
      "routing": null,
      "price": {
        "input": 0.3,
        "output": 2.5,
        "cacheRead": 0.03,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash",
      "provider": "vertex",
      "region": "europe-west8",
      "routing": null,
      "price": {
        "input": 0.3,
        "output": 2.5,
        "cacheRead": 0.03,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash",
      "provider": "vertex",
      "region": "europe-southwest1",
      "routing": null,
      "price": {
        "input": 0.3,
        "output": 2.5,
        "cacheRead": 0.03,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash",
      "provider": "vertex",
      "region": "europe-west9",
      "routing": null,
      "price": {
        "input": 0.3,
        "output": 2.5,
        "cacheRead": 0.03,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash",
      "provider": "vertex",
      "region": "asia-south1",
      "routing": null,
      "price": {
        "input": 0.3,
        "output": 2.5,
        "cacheRead": 0.03,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash",
      "provider": "vertex",
      "region": "asia-southeast1",
      "routing": null,
      "price": {
        "input": 0.3,
        "output": 2.5,
        "cacheRead": 0.03,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash",
      "provider": "vertex",
      "region": "asia-northeast1",
      "routing": null,
      "price": {
        "input": 0.3,
        "output": 2.5,
        "cacheRead": 0.03,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash",
      "provider": "vertex",
      "region": "australia-southeast1",
      "routing": null,
      "price": {
        "input": 0.3,
        "output": 2.5,
        "cacheRead": 0.03,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash",
      "provider": "vertex",
      "region": "asia-northeast3",
      "routing": null,
      "price": {
        "input": 0.3,
        "output": 2.5,
        "cacheRead": 0.03,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash-lite",
      "provider": "vertex",
      "region": "global",
      "routing": null,
      "price": {
        "input": 0.1,
        "output": 0.4,
        "cacheRead": 0.01,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash-lite",
      "provider": "vertex",
      "region": "us-west1",
      "routing": null,
      "price": {
        "input": 0.1,
        "output": 0.4,
        "cacheRead": 0.01,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash-lite",
      "provider": "vertex",
      "region": "us-west4",
      "routing": null,
      "price": {
        "input": 0.1,
        "output": 0.4,
        "cacheRead": 0.01,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash-lite",
      "provider": "vertex",
      "region": "us-central1",
      "routing": null,
      "price": {
        "input": 0.1,
        "output": 0.4,
        "cacheRead": 0.01,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash-lite",
      "provider": "vertex",
      "region": "us-east1",
      "routing": null,
      "price": {
        "input": 0.1,
        "output": 0.4,
        "cacheRead": 0.01,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash-lite",
      "provider": "vertex",
      "region": "us-east4",
      "routing": null,
      "price": {
        "input": 0.1,
        "output": 0.4,
        "cacheRead": 0.01,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash-lite",
      "provider": "vertex",
      "region": "us-east5",
      "routing": null,
      "price": {
        "input": 0.1,
        "output": 0.4,
        "cacheRead": 0.01,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash-lite",
      "provider": "vertex",
      "region": "us-south1",
      "routing": null,
      "price": {
        "input": 0.1,
        "output": 0.4,
        "cacheRead": 0.01,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash-lite",
      "provider": "vertex",
      "region": "europe-west1",
      "routing": null,
      "price": {
        "input": 0.1,
        "output": 0.4,
        "cacheRead": 0.01,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash-lite",
      "provider": "vertex",
      "region": "europe-west4",
      "routing": null,
      "price": {
        "input": 0.1,
        "output": 0.4,
        "cacheRead": 0.01,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash-lite",
      "provider": "vertex",
      "region": "europe-north1",
      "routing": null,
      "price": {
        "input": 0.1,
        "output": 0.4,
        "cacheRead": 0.01,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash-lite",
      "provider": "vertex",
      "region": "europe-central2",
      "routing": null,
      "price": {
        "input": 0.1,
        "output": 0.4,
        "cacheRead": 0.01,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash-lite",
      "provider": "vertex",
      "region": "europe-west8",
      "routing": null,
      "price": {
        "input": 0.1,
        "output": 0.4,
        "cacheRead": 0.01,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash-lite",
      "provider": "vertex",
      "region": "europe-southwest1",
      "routing": null,
      "price": {
        "input": 0.1,
        "output": 0.4,
        "cacheRead": 0.01,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-2-5-flash-lite",
      "provider": "vertex",
      "region": "europe-west9",
      "routing": null,
      "price": {
        "input": 0.1,
        "output": 0.4,
        "cacheRead": 0.01,
        "cacheWrite": 0
      }
    },
    {
      "model": "fake",
      "provider": "fake",
      "region": "",
      "routing": null,
      "price": {
        "input": 0,
        "output": 0,
        "cacheRead": 0,
        "cacheWrite": 0
      }
    },
    {
      "model": "fake",
      "provider": "fake-dev",
      "region": "",
      "routing": null,
      "price": {
        "input": 1,
        "output": 5,
        "cacheRead": 0.1,
        "cacheWrite": 1.25
      }
    }
  ]
};
