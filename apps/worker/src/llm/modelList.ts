// The list of models and prices the app uses (docs/llm.md, "The list of models and prices: code, generated").
// Generated from apps/worker/model-list/*.json by `npm run model-list -w apps/worker`: don't edit it by hand.

import type { ModelList } from "./models.ts";

export const MODEL_LIST: ModelList = {
  "asOf": "2026-11-05",
  "mock": true,
  "models": [
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
      "id": "claude-fable-5-1",
      "name": "Claude Fable 5.1",
      "family": "claude",
      "strings": {
        "anthropic": "claude-fable-5-1",
        "bedrock": "anthropic.claude-fable-5-1"
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
        "bedrock": "anthropic.claude-mythos-5-1"
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
        "bedrock": "anthropic.claude-fable-5"
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
        "bedrock": "anthropic.claude-mythos-5"
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
        "bedrock": "anthropic.claude-opus-5"
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
        "bedrock": "anthropic.claude-opus-4-8"
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
        "bedrock": "anthropic.claude-opus-4-7"
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
      "id": "claude-sonnet-5",
      "name": "Claude Sonnet 5",
      "family": "claude",
      "strings": {
        "bedrock": "anthropic.claude-sonnet-5"
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
        "bedrock": "anthropic.claude-haiku-4-5"
      },
      "efforts": []
    },
    {
      "id": "gemini-3-1-pro",
      "name": "Gemini 3.1 Pro",
      "family": "gemini",
      "strings": {
        "ai-studio": "gemini-3.1-pro",
        "vertex": "gemini-3.1-pro"
      }
    },
    {
      "id": "gemini-3-flash",
      "name": "Gemini 3 Flash",
      "family": "gemini",
      "strings": {
        "ai-studio": "gemini-3-flash",
        "vertex": "gemini-3-flash"
      }
    },
    {
      "id": "fake",
      "name": "Fake model",
      "family": "fake",
      "strings": {
        "fake": "fake",
        "fake-dev": "fake"
      }
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
      "region": "ap-northeast-1",
      "routings": [
        "global",
        "geographic",
        "in-region"
      ],
      "geography": "JP"
    },
    {
      "provider": "bedrock",
      "region": "ap-northeast-2",
      "routings": [
        "global"
      ]
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
        "global"
      ]
    },
    {
      "provider": "bedrock",
      "region": "ap-south-2",
      "routings": [
        "global"
      ]
    },
    {
      "provider": "bedrock",
      "region": "ap-southeast-1",
      "routings": [
        "global"
      ]
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
        "geographic",
        "in-region"
      ],
      "geography": "AU"
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
        "global"
      ]
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
        "geographic",
        "in-region"
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
        "geographic",
        "in-region"
      ],
      "geography": "EU"
    },
    {
      "provider": "bedrock",
      "region": "eu-west-2",
      "routings": [
        "global",
        "geographic"
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
        "global"
      ]
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
        "geographic",
        "in-region"
      ],
      "geography": "US"
    },
    {
      "provider": "bedrock",
      "region": "us-east-2",
      "routings": [
        "global",
        "geographic",
        "in-region"
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
        "geographic",
        "in-region"
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
      "region": "europe-west1",
      "routings": null
    },
    {
      "provider": "vertex",
      "region": "europe-west4",
      "routings": null
    },
    {
      "provider": "vertex",
      "region": "us-central1",
      "routings": null
    },
    {
      "provider": "vertex",
      "region": "us-east5",
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
      "model": "claude-sonnet-5-5",
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
      "region": "us-east-1",
      "routing": "in-region",
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
      "region": "us-east-2",
      "routing": "in-region",
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
      "model": "claude-fable-5-1",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "in-region",
      "price": {
        "input": 11,
        "output": 55,
        "cacheRead": 0.275,
        "cacheWrite": 13.75
      }
    },
    {
      "model": "claude-mythos-5-1",
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
      "model": "claude-mythos-5-1",
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
      "model": "claude-mythos-5-1",
      "provider": "bedrock",
      "region": "us-east-1",
      "routing": "in-region",
      "price": {
        "input": 11,
        "output": 55,
        "cacheRead": 0.275,
        "cacheWrite": 13.75
      }
    },
    {
      "model": "claude-mythos-5-1",
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
      "model": "claude-mythos-5-1",
      "provider": "bedrock",
      "region": "us-east-2",
      "routing": "in-region",
      "price": {
        "input": 11,
        "output": 55,
        "cacheRead": 0.275,
        "cacheWrite": 13.75
      }
    },
    {
      "model": "claude-mythos-5-1",
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
      "model": "claude-mythos-5-1",
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
      "model": "claude-mythos-5-1",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "in-region",
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
      "region": "ap-southeast-2",
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
      "region": "ap-southeast-4",
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
      "region": "ap-southeast-4",
      "routing": "in-region",
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
      "region": "eu-central-1",
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
      "region": "eu-central-2",
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
      "region": "eu-north-1",
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
      "region": "eu-north-1",
      "routing": "in-region",
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
      "region": "eu-south-1",
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
      "region": "eu-south-2",
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
      "region": "eu-west-1",
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
      "region": "eu-west-1",
      "routing": "in-region",
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
      "region": "eu-west-2",
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
      "region": "eu-west-3",
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
      "region": "us-east-1",
      "routing": "in-region",
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
      "region": "us-east-2",
      "routing": "in-region",
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
      "model": "claude-fable-5",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "in-region",
      "price": {
        "input": 11,
        "output": 55,
        "cacheRead": 1.1,
        "cacheWrite": 13.75
      }
    },
    {
      "model": "claude-mythos-5",
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
      "model": "claude-mythos-5",
      "provider": "bedrock",
      "region": "us-east-1",
      "routing": "in-region",
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
      "region": "ap-northeast-1",
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
      "region": "ap-southeast-4",
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
      "region": "eu-north-1",
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
      "region": "eu-west-1",
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
      "region": "us-east-1",
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
      "region": "us-east-2",
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
      "model": "claude-opus-5-5",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "in-region",
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
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "ap-northeast-1",
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
      "region": "ap-southeast-4",
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
      "region": "eu-north-1",
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
      "region": "eu-west-1",
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
      "region": "us-east-1",
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
      "region": "us-east-2",
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
      "model": "claude-opus-5",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "in-region",
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
      "region": "ap-northeast-1",
      "routing": "in-region",
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
      "region": "ap-southeast-4",
      "routing": "in-region",
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
      "region": "eu-north-1",
      "routing": "in-region",
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
      "region": "eu-west-1",
      "routing": "in-region",
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
      "region": "us-east-1",
      "routing": "in-region",
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
      "region": "us-east-2",
      "routing": "in-region",
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
      "model": "claude-opus-4-8",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "in-region",
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
      "region": "ap-northeast-1",
      "routing": "in-region",
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
      "region": "ap-southeast-4",
      "routing": "in-region",
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
      "region": "eu-north-1",
      "routing": "in-region",
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
      "region": "eu-west-1",
      "routing": "in-region",
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
      "region": "us-east-1",
      "routing": "in-region",
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
      "region": "us-east-2",
      "routing": "in-region",
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
      "model": "claude-opus-4-7",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "in-region",
      "price": {
        "input": 5.5,
        "output": 27.5,
        "cacheRead": 0.55,
        "cacheWrite": 6.875
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
      "region": "ap-southeast-4",
      "routing": "in-region",
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
      "region": "eu-north-1",
      "routing": "in-region",
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
      "region": "eu-west-1",
      "routing": "in-region",
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
      "region": "us-east-1",
      "routing": "in-region",
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
      "region": "us-east-2",
      "routing": "in-region",
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
      "model": "claude-sonnet-5-5",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "in-region",
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
      "region": "ap-northeast-1",
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
      "region": "ap-northeast-1",
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
      "region": "ap-northeast-3",
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
      "region": "ap-southeast-4",
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
      "region": "eu-north-1",
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
      "region": "eu-west-1",
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
      "region": "us-east-1",
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
      "region": "us-east-2",
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
      "model": "claude-sonnet-5",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "in-region",
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.22,
        "cacheWrite": 2.75
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
      "region": "ap-northeast-1",
      "routing": "in-region",
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
      "region": "ap-southeast-4",
      "routing": "in-region",
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
      "region": "eu-north-1",
      "routing": "in-region",
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
      "region": "eu-west-1",
      "routing": "in-region",
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
      "region": "us-east-1",
      "routing": "in-region",
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
      "region": "us-east-2",
      "routing": "in-region",
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
      "model": "claude-haiku-5-5",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "in-region",
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
      "region": "ap-northeast-1",
      "routing": "in-region",
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
      "region": "ap-southeast-4",
      "routing": "in-region",
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
      "region": "eu-north-1",
      "routing": "in-region",
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
      "region": "eu-west-1",
      "routing": "in-region",
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
      "region": "us-east-1",
      "routing": "in-region",
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
      "region": "us-east-2",
      "routing": "in-region",
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
      "model": "claude-haiku-4-5",
      "provider": "bedrock",
      "region": "us-west-2",
      "routing": "in-region",
      "price": {
        "input": 1.1,
        "output": 5.5,
        "cacheRead": 0.11,
        "cacheWrite": 1.375
      }
    },
    {
      "model": "gemini-3-1-pro",
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
      "model": "gemini-3-flash",
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
      "region": "us-east5",
      "routing": null,
      "price": {
        "input": 4.4,
        "output": 22,
        "cacheRead": 0.22,
        "cacheWrite": 5.5
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
        "cacheRead": 0.2,
        "cacheWrite": 2.5
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "vertex",
      "region": "europe-west1",
      "routing": null,
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.22,
        "cacheWrite": 2.75
      }
    },
    {
      "model": "claude-sonnet-5-5",
      "provider": "vertex",
      "region": "us-east5",
      "routing": null,
      "price": {
        "input": 2.2,
        "output": 11,
        "cacheRead": 0.22,
        "cacheWrite": 2.75
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
      "model": "gemini-3-1-pro",
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
      "model": "gemini-3-1-pro",
      "provider": "vertex",
      "region": "europe-west1",
      "routing": null,
      "price": {
        "input": 2,
        "output": 12,
        "cacheRead": 0.2,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-flash",
      "provider": "vertex",
      "region": "global",
      "routing": null,
      "price": {
        "input": 0.5,
        "output": 3,
        "cacheRead": 0.05,
        "cacheWrite": 0
      }
    },
    {
      "model": "gemini-3-flash",
      "provider": "vertex",
      "region": "europe-west1",
      "routing": null,
      "price": {
        "input": 0.5,
        "output": 3,
        "cacheRead": 0.05,
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
