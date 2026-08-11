# Ingest API suite — mirrors src/ingest/server.test.ts
# Captures only share within a single Hurl file (Hurl isolates multi-file runs).

# --- AUTH: login ---
POST {{host}}/auth/login
Content-Type: application/json
[Options]
output: res/01-auth-login.json
```json
{
	"email": "{{email}}",
	"password": "{{password}}"
}
```
HTTP 200
[Captures]
access_token: jsonpath "$.token"
refresh_token: jsonpath "$.refreshToken"
[Asserts]
jsonpath "$.expiresIn" exists
jsonpath "$.expires" exists
jsonpath "$.token" exists
jsonpath "$.refreshToken" exists
jsonpath "$.user" exists
jsonpath "$.user.user_id" exists
jsonpath "$.user.email_verified" exists

# --- AUTH: refresh ---
POST {{host}}/auth/refresh
Content-Type: application/json
[Options]
output: res/02-auth-refresh.json
```json
{
	"refreshToken": "{{refresh_token}}"
}
```
HTTP 200
[Captures]
access_token: jsonpath "$.token"
refresh_token: jsonpath "$.refreshToken"
[Asserts]
jsonpath "$.expiresIn" exists
jsonpath "$.expires" exists
jsonpath "$.token" exists
jsonpath "$.refreshToken" exists
jsonpath "$.user" exists
jsonpath "$.user.user_id" exists
jsonpath "$.user.email_verified" exists

# --- EVENTS: missing auth → 401 ---
POST {{host}}/events/de.ard.eventhub.v1.radio.track.playing
Content-Type: application/json
[Options]
output: res/03-events-missing-auth.json
```json
{
	"event": "de.ard.eventhub.v1.radio.track.playing",
	"type": "music",
	"start": "{{start}}",
	"length": 240,
	"title": "Unit Test Song",
	"services": [
		{
			"type": "PermanentLivestream",
			"externalId": "crid://ard.de/28475/unit",
			"publisherId": "28475"
		}
	],
	"playlistItemId": "unit-test-id-in-playlist-567",
	"references": [
		{
			"type": "Show",
			"externalId": "crid://ard.de/my-show/1234567",
			"alternateIds": [
				"https://normdb.ivz.cn.ard.de/sendereihe/427",
				"urn:ard:show:027708befb6bfe14",
				"brid://br.de/broadcastSeries/1235"
			]
		},
		{
			"type": "Article",
			"externalId": "crid://dlf.de/article/1234567",
			"title": "Kommerzielle US-Raumfahrt - Die neue Weltraumökonomie",
			"url": "https://www.deutschlandfunkkultur.de/kommerzielle-us-raumfahrt-die-neue-weltraumoekonomie-100.html"
		}
	]
}
```
HTTP 401
[Asserts]
jsonpath "$.message" isString
jsonpath "$.errors" isCollection
jsonpath "$.errors" count >= 1
jsonpath "$.errors[0].path" isString
jsonpath "$.errors[0].message" isString
jsonpath "$.errors[0].errorCode" isString
jsonpath "$.trace" == null

# --- EVENTS: invalid auth → 403 ---
POST {{host}}/events/de.ard.eventhub.v1.radio.track.playing
Authorization: Bearer invalid{{access_token}}
Content-Type: application/json
[Options]
output: res/03-events-invalid-auth.json
```json
{
	"event": "de.ard.eventhub.v1.radio.track.playing",
	"type": "music",
	"start": "{{start}}",
	"length": 240,
	"title": "Unit Test Song",
	"services": [
		{
			"type": "PermanentLivestream",
			"externalId": "crid://ard.de/28475/unit",
			"publisherId": "28475"
		}
	],
	"playlistItemId": "unit-test-id-in-playlist-567",
	"references": [
		{
			"type": "Show",
			"externalId": "crid://ard.de/my-show/1234567",
			"alternateIds": [
				"https://normdb.ivz.cn.ard.de/sendereihe/427",
				"urn:ard:show:027708befb6bfe14",
				"brid://br.de/broadcastSeries/1235"
			]
		},
		{
			"type": "Article",
			"externalId": "crid://dlf.de/article/1234567",
			"title": "Kommerzielle US-Raumfahrt - Die neue Weltraumökonomie",
			"url": "https://www.deutschlandfunkkultur.de/kommerzielle-us-raumfahrt-die-neue-weltraumoekonomie-100.html"
		}
	]
}
```
HTTP 403

# --- EVENTS: publish happy path → 201 ---
POST {{host}}/events/de.ard.eventhub.v1.radio.track.playing
Authorization: Bearer {{access_token}}
Content-Type: application/json
[Options]
output: res/03-events-publish.json
```json
{
	"event": "de.ard.eventhub.v1.radio.track.playing",
	"type": "music",
	"start": "{{start}}",
	"length": 240,
	"title": "Unit Test Song",
	"services": [
		{
			"type": "PermanentLivestream",
			"externalId": "crid://ard.de/28475/unit",
			"publisherId": "28475"
		}
	],
	"playlistItemId": "unit-test-id-in-playlist-567",
	"references": [
		{
			"type": "Show",
			"externalId": "crid://ard.de/my-show/1234567",
			"alternateIds": [
				"https://normdb.ivz.cn.ard.de/sendereihe/427",
				"urn:ard:show:027708befb6bfe14",
				"brid://br.de/broadcastSeries/1235"
			]
		},
		{
			"type": "Article",
			"externalId": "crid://dlf.de/article/1234567",
			"title": "Kommerzielle US-Raumfahrt - Die neue Weltraumökonomie",
			"url": "https://www.deutschlandfunkkultur.de/kommerzielle-us-raumfahrt-die-neue-weltraumoekonomie-100.html"
		}
	]
}
```
HTTP 201
[Asserts]
jsonpath "$.statuses" exists
jsonpath "$.event" exists

# --- EVENTS: expired start → 400 ---
POST {{host}}/events/de.ard.eventhub.v1.radio.track.playing
Authorization: Bearer {{access_token}}
Content-Type: application/json
[Options]
output: res/03-events-expired-start.json
```json
{
	"event": "de.ard.eventhub.v1.radio.track.playing",
	"type": "music",
	"start": "{{start_expired}}",
	"length": 240,
	"title": "Unit Test Song",
	"services": [
		{
			"type": "PermanentLivestream",
			"externalId": "crid://ard.de/28475/unit",
			"publisherId": "28475"
		}
	],
	"playlistItemId": "unit-test-id-in-playlist-567",
	"references": [
		{
			"type": "Show",
			"externalId": "crid://ard.de/my-show/1234567",
			"alternateIds": [
				"https://normdb.ivz.cn.ard.de/sendereihe/427",
				"urn:ard:show:027708befb6bfe14",
				"brid://br.de/broadcastSeries/1235"
			]
		},
		{
			"type": "Article",
			"externalId": "crid://dlf.de/article/1234567",
			"title": "Kommerzielle US-Raumfahrt - Die neue Weltraumökonomie",
			"url": "https://www.deutschlandfunkkultur.de/kommerzielle-us-raumfahrt-die-neue-weltraumoekonomie-100.html"
		}
	]
}
```
HTTP 400

# --- EVENTS: invalid start format → 400 ---
POST {{host}}/events/de.ard.eventhub.v1.radio.track.playing
Authorization: Bearer {{access_token}}
Content-Type: application/json
[Options]
output: res/03-events-invalid-start.json
```json
{
	"event": "de.ard.eventhub.v1.radio.track.playing",
	"type": "music",
	"start": "{{start_invalid}}",
	"length": 240,
	"title": "Unit Test Song",
	"services": [
		{
			"type": "PermanentLivestream",
			"externalId": "crid://ard.de/28475/unit",
			"publisherId": "28475"
		}
	],
	"playlistItemId": "unit-test-id-in-playlist-567",
	"references": [
		{
			"type": "Show",
			"externalId": "crid://ard.de/my-show/1234567",
			"alternateIds": [
				"https://normdb.ivz.cn.ard.de/sendereihe/427",
				"urn:ard:show:027708befb6bfe14",
				"brid://br.de/broadcastSeries/1235"
			]
		},
		{
			"type": "Article",
			"externalId": "crid://dlf.de/article/1234567",
			"title": "Kommerzielle US-Raumfahrt - Die neue Weltraumökonomie",
			"url": "https://www.deutschlandfunkkultur.de/kommerzielle-us-raumfahrt-die-neue-weltraumoekonomie-100.html"
		}
	]
}
```
HTTP 400

# --- EVENTS: invalid externalId in references → 400 ---
POST {{host}}/events/de.ard.eventhub.v1.radio.track.playing
Authorization: Bearer {{access_token}}
Content-Type: application/json
Accept: application/json
[Options]
output: res/03-events-invalid-reference.json
```json
{
	"event": "de.ard.eventhub.v1.radio.track.playing",
	"type": "music",
	"start": "{{start}}",
	"length": 240,
	"title": "Unit Test Song",
	"services": [
		{
			"type": "PermanentLivestream",
			"externalId": "crid://ard.de/28475/unit",
			"publisherId": "28475"
		}
	],
	"playlistItemId": "unit-test-id-in-playlist-567",
	"references": [
		{
			"type": "Show",
			"externalId": "crid://ard.de/my-show/1234567",
			"alternateIds": [
				"https://normdb.ivz.cn.ard.de/sendereihe/427",
				"urn:ard:show:027708befb6bfe14",
				"brid://br.de/broadcastSeries/1235"
			]
		},
		{
			"type": "Article",
			"externalId": null,
			"title": "Kommerzielle US-Raumfahrt - Die neue Weltraumökonomie",
			"url": "https://www.deutschlandfunkkultur.de/kommerzielle-us-raumfahrt-die-neue-weltraumoekonomie-100.html"
		}
	]
}
```
HTTP 400

# --- EVENTS: length 0 → 400 ---
POST {{host}}/events/de.ard.eventhub.v1.radio.track.playing
Authorization: Bearer {{access_token}}
Content-Type: application/json
[Options]
output: res/03-events-length-zero.json
```json
{
	"event": "de.ard.eventhub.v1.radio.track.playing",
	"type": "music",
	"start": "{{start}}",
	"length": 0,
	"title": "Unit Test Song",
	"services": [
		{
			"type": "PermanentLivestream",
			"externalId": "crid://ard.de/28475/unit",
			"publisherId": "28475"
		}
	],
	"playlistItemId": "unit-test-id-in-playlist-567-length-zero"
}
```
HTTP 400

# --- EVENTS: length null → 400 ---
POST {{host}}/events/de.ard.eventhub.v1.radio.track.playing
Authorization: Bearer {{access_token}}
Content-Type: application/json
[Options]
output: res/03-events-length-null.json
```json
{
	"event": "de.ard.eventhub.v1.radio.track.playing",
	"type": "music",
	"start": "{{start}}",
	"length": null,
	"title": "Unit Test Song",
	"services": [
		{
			"type": "PermanentLivestream",
			"externalId": "crid://ard.de/28475/unit",
			"publisherId": "28475"
		}
	],
	"playlistItemId": "unit-test-id-in-playlist-567-length-null"
}
```
HTTP 400

# --- EVENTS: media isFallback true → 201 ---
POST {{host}}/events/de.ard.eventhub.v1.radio.track.playing
Authorization: Bearer {{access_token}}
Content-Type: application/json
[Options]
output: res/04-events-media-fallback-true.json
```json
{
	"event": "de.ard.eventhub.v1.radio.track.playing",
	"type": "music",
	"start": "{{start}}",
	"length": 240,
	"title": "Unit Test Song with Fallback Media",
	"services": [
		{
			"type": "PermanentLivestream",
			"externalId": "crid://ard.de/28475/unit",
			"publisherId": "28475"
		}
	],
	"playlistItemId": "unit-test-id-in-playlist-567-fallback",
	"media": [
		{
			"type": "cover",
			"url": "https://example.com/fallback-cover.jpg",
			"templateUrl": null,
			"description": "Fallback Cover Image",
			"attribution": null,
			"isFallback": true
		}
	]
}
```
HTTP 201
[Asserts]
jsonpath "$.statuses" exists
jsonpath "$.event" exists

# --- EVENTS: media isFallback false → 201 ---
POST {{host}}/events/de.ard.eventhub.v1.radio.track.playing
Authorization: Bearer {{access_token}}
Content-Type: application/json
[Options]
output: res/04-events-media-fallback-false.json
```json
{
	"event": "de.ard.eventhub.v1.radio.track.playing",
	"type": "music",
	"start": "{{start}}",
	"length": 240,
	"title": "Unit Test Song with Non-Fallback Media",
	"services": [
		{
			"type": "PermanentLivestream",
			"externalId": "crid://ard.de/28475/unit",
			"publisherId": "28475"
		}
	],
	"playlistItemId": "unit-test-id-in-playlist-567-non-fallback",
	"media": [
		{
			"type": "cover",
			"url": "https://example.com/cover.jpg",
			"templateUrl": null,
			"description": "Official Cover Image",
			"attribution": "Photographer XYZ",
			"isFallback": false
		}
	]
}
```
HTTP 201
[Asserts]
jsonpath "$.statuses" exists
jsonpath "$.event" exists

# --- EVENTS: media without isFallback → 201 ---
POST {{host}}/events/de.ard.eventhub.v1.radio.track.playing
Authorization: Bearer {{access_token}}
Content-Type: application/json
[Options]
output: res/04-events-media-no-fallback-flag.json
```json
{
	"event": "de.ard.eventhub.v1.radio.track.playing",
	"type": "music",
	"start": "{{start}}",
	"length": 240,
	"title": "Unit Test Song without isFallback",
	"services": [
		{
			"type": "PermanentLivestream",
			"externalId": "crid://ard.de/28475/unit",
			"publisherId": "28475"
		}
	],
	"playlistItemId": "unit-test-id-in-playlist-567-no-flag",
	"media": [
		{
			"type": "cover",
			"url": "https://example.com/cover.jpg",
			"templateUrl": null,
			"description": "Cover without isFallback field",
			"attribution": null
		}
	]
}
```
HTTP 201
[Asserts]
jsonpath "$.statuses" exists
jsonpath "$.event" exists

# --- EVENTS: all services blocked → 201, no common plugin ---
POST {{host}}/events/de.ard.eventhub.v1.radio.track.playing
Authorization: Bearer {{access_token}}
Content-Type: application/json
[Options]
output: res/05-events-blocked-service.json
```json
{
	"event": "de.ard.eventhub.v1.radio.track.playing",
	"type": "music",
	"start": "{{start}}",
	"length": 240,
	"title": "Unit Test Song with Blocked Service",
	"services": [
		{
			"type": "PermanentLivestream",
			"externalId": "crid://ard.de/999999/unit",
			"publisherId": "999999"
		}
	],
	"playlistItemId": "unit-test-id-in-playlist-567-blocked"
}
```
HTTP 201
[Asserts]
jsonpath "$.statuses" exists
jsonpath "$.event" exists
jsonpath "$.statuses.blocked" > 0
jsonpath "$.event.services[?(@.blocked)]" exists
jsonpath "$.plugins[?(@.type=='common')]" not exists

# --- EVENTS: mixed blocked + non-blocked → 201, common plugin present ---
POST {{host}}/events/de.ard.eventhub.v1.radio.track.playing
Authorization: Bearer {{access_token}}
Content-Type: application/json
[Options]
output: res/05-events-mixed-services.json
```json
{
	"event": "de.ard.eventhub.v1.radio.track.playing",
	"type": "music",
	"start": "{{start}}",
	"length": 240,
	"title": "Unit Test Song with Mixed Services",
	"services": [
		{
			"type": "PermanentLivestream",
			"externalId": "crid://ard.de/28475/unit",
			"publisherId": "28475"
		},
		{
			"type": "PermanentLivestream",
			"externalId": "crid://ard.de/999999/unit",
			"publisherId": "999999"
		}
	],
	"playlistItemId": "unit-test-id-in-playlist-567-mixed"
}
```
HTTP 201
[Asserts]
jsonpath "$.statuses" exists
jsonpath "$.event" exists
jsonpath "$.statuses.blocked" > 0
jsonpath "$.event.services" count == 2
jsonpath "$.event.services[?(@.blocked)]" exists
jsonpath "$.plugins[?(@.type=='common')]" exists
jsonpath "$.plugins[?(@.type=='common')].topic" exists

# --- EVENTS: only non-blocked services → 201, common plugin present ---
POST {{host}}/events/de.ard.eventhub.v1.radio.track.playing
Authorization: Bearer {{access_token}}
Content-Type: application/json
[Options]
output: res/05-events-non-blocked-services.json
```json
{
	"event": "de.ard.eventhub.v1.radio.track.playing",
	"type": "music",
	"start": "{{start}}",
	"length": 240,
	"title": "Unit Test Song with Non-Blocked Services",
	"services": [
		{
			"type": "PermanentLivestream",
			"externalId": "crid://ard.de/28475/unit",
			"publisherId": "28475"
		}
	],
	"playlistItemId": "unit-test-id-in-playlist-567-non-blocked"
}
```
HTTP 201
[Asserts]
jsonpath "$.statuses" exists
jsonpath "$.event" exists
jsonpath "$.statuses.blocked" == 0
jsonpath "$.event.services[?(@.blocked)]" not exists
jsonpath "$.plugins[?(@.type=='common')]" exists
jsonpath "$.plugins[?(@.type=='common')].topic" exists

# --- PUBSUB: missing auth on PUT → 401 ---
PUT {{host}}/pubsub
Content-Type: application/json
[Options]
output: res/05-pubsub-put-missing-auth.json
```json
{
	"message": { "data": "e30=", "messageId": "unit-test" },
	"subscription": "unit-test"
}
```
HTTP 401
[Asserts]
jsonpath "$.message" isString
jsonpath "$.errors" isCollection
jsonpath "$.errors" count >= 1
jsonpath "$.trace" == null

# --- PUBSUB: invalid auth on PUT → 403 ---
PUT {{host}}/pubsub
Authorization: Bearer invalid{{access_token}}
Content-Type: application/json
[Options]
output: res/05-pubsub-put-invalid-auth.json
```json
{
	"message": { "data": "e30=", "messageId": "unit-test" },
	"subscription": "unit-test"
}
```
HTTP 403

# --- PUBSUB: missing auth on POST → 401 ---
POST {{host}}/pubsub
Content-Type: application/json
[Options]
output: res/05-pubsub-post-missing-auth.json
```json
{
	"message": { "data": "e30=", "messageId": "unit-test" },
	"subscription": "unit-test"
}
```
HTTP 401

# --- PUBSUB: invalid auth on POST → 500 ---
POST {{host}}/pubsub
Authorization: Bearer invalid{{access_token}}
Content-Type: application/json
[Options]
output: res/05-pubsub-post-invalid-auth.json
```json
{
	"message": { "data": "e30=", "messageId": "unit-test" },
	"subscription": "unit-test"
}
```
HTTP 500

# --- TOPICS: missing auth → 401 ---
GET {{host}}/topics
[Options]
output: res/06-topics-missing-auth.json
HTTP 401
[Asserts]
jsonpath "$.message" isString
jsonpath "$.errors" isCollection
jsonpath "$.errors" count >= 1
jsonpath "$.trace" == null

# --- TOPICS: invalid auth → 403 ---
GET {{host}}/topics
Authorization: Bearer invalid{{access_token}}
[Options]
output: res/06-topics-invalid-auth.json
HTTP 403

# --- TOPICS: missing auth on named path → 401 ---
GET {{host}}/topics/unit-test-topic
[Options]
output: res/06-topics-named-missing-auth.json
HTTP 401
[Asserts]
jsonpath "$.message" isString
jsonpath "$.errors" isCollection
jsonpath "$.errors" count >= 1
jsonpath "$.trace" == null

# --- TOPICS: invalid auth on named path → 403 ---
GET {{host}}/topics/unit-test-topic
Authorization: Bearer invalid{{access_token}}
[Options]
output: res/06-topics-named-invalid-auth.json
HTTP 403

# --- TOPICS: list → 200 ---
GET {{host}}/topics
Authorization: Bearer {{access_token}}
[Options]
output: res/06-topics-list.json
HTTP 200
[Captures]
topic_id: jsonpath "$[0].id"
[Asserts]
jsonpath "$" isCollection
jsonpath "$[0].type" isString
jsonpath "$[0].id" isString
jsonpath "$[0].name" isString
jsonpath "$[0].labels" exists

# --- TOPICS: named path → 200 ---
GET {{host}}/topics/unit-test-topic
Authorization: Bearer {{access_token}}
[Options]
output: res/06-topics-named-list.json
HTTP 200
[Asserts]
jsonpath "$" isCollection
jsonpath "$[0].type" isString
jsonpath "$[0].id" isString
jsonpath "$[0].name" isString

# --- SUBSCRIPTIONS: missing auth on create → 401 ---
POST {{host}}/subscriptions
Content-Type: application/json
[Options]
output: res/07-subscriptions-create-missing-auth.json
```json
{
	"type": "PUBSUB",
	"method": "PUSH",
	"url": "https://ard.unit.test/eventhub/subscription",
	"contact": "eventhub-unit-test@ard.de",
	"topic": "{{topic_id}}"
}
```
HTTP 401
[Asserts]
jsonpath "$.message" isString
jsonpath "$.errors" isCollection
jsonpath "$.errors" count >= 1
jsonpath "$.trace" == null

# --- SUBSCRIPTIONS: invalid auth on create → 403 ---
POST {{host}}/subscriptions
Authorization: Bearer invalid{{access_token}}
Content-Type: application/json
[Options]
output: res/07-subscriptions-create-invalid-auth.json
```json
{
	"type": "PUBSUB",
	"method": "PUSH",
	"url": "https://ard.unit.test/eventhub/subscription",
	"contact": "eventhub-unit-test@ard.de",
	"topic": "{{topic_id}}"
}
```
HTTP 403

# --- SUBSCRIPTIONS: create → 201 ---
POST {{host}}/subscriptions
Authorization: Bearer {{access_token}}
Content-Type: application/json
[Options]
output: res/07-subscriptions-create.json
```json
{
	"type": "PUBSUB",
	"method": "PUSH",
	"url": "https://ard.unit.test/eventhub/subscription",
	"contact": "eventhub-unit-test@ard.de",
	"topic": "{{topic_id}}"
}
```
HTTP 201
[Captures]
subscription_name: jsonpath "$.name"
[Asserts]
jsonpath "$.type" isString
jsonpath "$.method" isString
jsonpath "$.name" isString
jsonpath "$.path" isString
jsonpath "$.topic" exists
jsonpath "$.topic.id" isString
jsonpath "$.topic.name" isString
jsonpath "$.topic.path" isString
jsonpath "$.ackDeadlineSeconds" isInteger
jsonpath "$.serviceAccount" isString
jsonpath "$.url" isString
jsonpath "$.contact" isString
jsonpath "$.institutionId" isString

# --- SUBSCRIPTIONS: missing auth on list → 401 ---
GET {{host}}/subscriptions
[Options]
output: res/07-subscriptions-list-missing-auth.json
HTTP 401
[Asserts]
jsonpath "$.message" isString
jsonpath "$.errors" isCollection
jsonpath "$.errors" count >= 1
jsonpath "$.trace" == null

# --- SUBSCRIPTIONS: invalid auth on list → 403 ---
GET {{host}}/subscriptions
Authorization: Bearer invalid{{access_token}}
[Options]
output: res/07-subscriptions-list-invalid-auth.json
HTTP 403

# --- SUBSCRIPTIONS: list → 200 ---
GET {{host}}/subscriptions
Authorization: Bearer {{access_token}}
[Options]
output: res/07-subscriptions-list.json
HTTP 200
[Asserts]
jsonpath "$" isCollection
jsonpath "$[0].type" isString
jsonpath "$[0].method" isString
jsonpath "$[0].name" isString
jsonpath "$[0].path" isString
jsonpath "$[0].topic.id" isString
jsonpath "$[0].ackDeadlineSeconds" isInteger
jsonpath "$[0].serviceAccount" isString
jsonpath "$[0].url" isString
jsonpath "$[0].contact" isString
jsonpath "$[0].institutionId" isString

# --- SUBSCRIPTIONS: missing auth on get → 401 ---
GET {{host}}/subscriptions/{{subscription_name}}
[Options]
output: res/07-subscriptions-get-missing-auth.json
HTTP 401
[Asserts]
jsonpath "$.message" isString
jsonpath "$.errors" isCollection
jsonpath "$.errors" count >= 1
jsonpath "$.trace" == null

# --- SUBSCRIPTIONS: invalid auth on get → 403 ---
GET {{host}}/subscriptions/{{subscription_name}}
Authorization: Bearer invalid{{access_token}}
[Options]
output: res/07-subscriptions-get-invalid-auth.json
HTTP 403

# --- SUBSCRIPTIONS: get one → 200 ---
GET {{host}}/subscriptions/{{subscription_name}}
Authorization: Bearer {{access_token}}
[Options]
output: res/07-subscriptions-get.json
HTTP 200
[Asserts]
jsonpath "$.type" isString
jsonpath "$.method" isString
jsonpath "$.name" isString
jsonpath "$.path" isString
jsonpath "$.topic.id" isString
jsonpath "$.ackDeadlineSeconds" isInteger
jsonpath "$.serviceAccount" isString
jsonpath "$.url" isString
jsonpath "$.contact" isString
jsonpath "$.institutionId" isString

# --- SUBSCRIPTIONS: missing auth on delete → 401 ---
DELETE {{host}}/subscriptions/{{subscription_name}}
[Options]
output: res/07-subscriptions-delete-missing-auth.json
HTTP 401
[Asserts]
jsonpath "$.message" isString
jsonpath "$.errors" isCollection
jsonpath "$.errors" count >= 1
jsonpath "$.trace" == null

# --- SUBSCRIPTIONS: invalid auth on delete → 403 ---
DELETE {{host}}/subscriptions/{{subscription_name}}
Authorization: Bearer invalid{{access_token}}
[Options]
output: res/07-subscriptions-delete-invalid-auth.json
HTTP 403

# --- SUBSCRIPTIONS: delete → 200 ---
DELETE {{host}}/subscriptions/{{subscription_name}}
Authorization: Bearer {{access_token}}
[Options]
output: res/07-subscriptions-delete.json
HTTP 200
[Asserts]
jsonpath "$.valid" == true
