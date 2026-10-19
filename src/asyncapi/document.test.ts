import { test } from '@cross/test'
import { assertEquals, assertExists, assertStrictEquals } from '@std/assert'
import { buildAsyncApiDocument } from './document.ts'

test('buildAsyncApiDocument is AsyncAPI 3 with Connect send and receive operations', () => {
	const document = buildAsyncApiDocument()

	assertStrictEquals(document.asyncapi, '3.0.0')
	assertEquals(document.info.title, 'ARD Eventhub Connect')
	assertEquals(document.servers.connect.protocolVersion, '3.1.1')
	assertExists(document.info.version)

	const inbox = document.channels.inboxInstitution
	const radioTrackPlaying = document.channels.radioLivestreamTrackPlaying
	const radioTrackNext = document.channels.radioLivestreamTrackNext
	const radioControl = document.channels.radioLivestreamControl
	const radioData = document.channels.radioLivestreamData
	const feedback = document.channels.feedbackInstitution
	assertExists(inbox)
	assertEquals(inbox.address, 'inbox/{institutionId}')
	assertEquals(inbox.title, 'inbox/{institutionId}')
	assertEquals(Object.keys(inbox.messages), ['radioTrackPlaying', 'radioTrackNext', 'radioControl', 'radioData'])
	assertEquals(radioTrackPlaying.address, 'radio/{livestreamId}/track/playing')
	assertEquals(radioTrackNext.address, 'radio/{livestreamId}/track/next')
	assertEquals(radioControl.address, 'radio/{livestreamId}/control')
	assertEquals(radioControl.title, 'radio/{livestreamId}/control')
	assertEquals(radioData.address, 'radio/{livestreamId}/data')
	assertEquals(radioData.title, 'radio/{livestreamId}/data')
	assertEquals(feedback.address, 'feedback/{institutionId}')
	assertEquals(feedback.title, 'feedback/{institutionId}')

	assertEquals(document.operations.sendRadioTrackPlaying.action, 'send')
	assertEquals(document.operations.sendRadioTrackPlaying.channel.$ref, '#/channels/inboxInstitution')
	assertEquals(document.operations.sendRadioTrackPlaying.bindings.mqtt, { qos: 1, retain: false })
	assertEquals(document.operations.sendRadioTrackNext.action, 'send')
	assertEquals(document.operations.sendRadioControl.action, 'send')
	assertEquals(document.operations.sendRadioControl.channel.$ref, '#/channels/inboxInstitution')
	assertEquals(document.operations.sendRadioData.action, 'send')
	assertEquals(document.operations.receiveRadioTrackPlaying.action, 'receive')
	assertEquals(document.operations.receiveRadioTrackPlaying.channel.$ref, '#/channels/radioLivestreamTrackPlaying')
	assertEquals(document.operations.receiveRadioTrackPlaying.bindings.mqtt, { qos: 1, retain: true })
	assertEquals(document.operations.receiveRadioTrackNext.action, 'receive')
	assertEquals(document.operations.receiveRadioTrackNext.channel.$ref, '#/channels/radioLivestreamTrackNext')
	assertEquals(document.operations.receiveRadioControl.action, 'receive')
	assertEquals(document.operations.receiveRadioControl.channel.$ref, '#/channels/radioLivestreamControl')
	assertEquals(document.operations.receiveRadioData.action, 'receive')
	assertEquals(document.operations.receiveFeedback.action, 'receive')
	assertEquals(document.operations.receiveFeedback.channel.$ref, '#/channels/feedbackInstitution')
	assertEquals(document.operations.receiveFeedback.bindings.mqtt, { qos: 1, retain: true })
	assertEquals(document.operations.sendRadioControl.title, 'Publish radio.control on inbox/{institutionId}')
	assertEquals(document.operations.sendRadioTrackPlaying.title, 'Publish track.playing on inbox/{institutionId}')
	assertEquals(document.operations.receiveFeedback.title, 'Subscribe feedback/{institutionId}')
	assertEquals(document.operations.sendRadioTrackPlaying.externalDocs, {
		description: 'de.ard.eventhub.v1.radio.track.playing',
		url: 'https://swrlab.github.io/ard-eventhub/event/radio.track.playing',
	})
	assertEquals(
		document.operations.receiveRadioTrackPlaying.externalDocs?.url,
		document.operations.sendRadioTrackPlaying.externalDocs?.url
	)
	assertEquals(
		document.operations.receiveRadioTrackNext.externalDocs?.url,
		'https://swrlab.github.io/ard-eventhub/event/radio.track.next'
	)
	assertEquals(
		document.operations.receiveRadioControl.externalDocs?.url,
		'https://swrlab.github.io/ard-eventhub/event/radio.control'
	)
	assertEquals(
		document.operations.receiveRadioData.externalDocs?.url,
		'https://swrlab.github.io/ard-eventhub/event/radio.data'
	)
	assertEquals(document.operations.receiveFeedback.externalDocs, undefined)

	assertEquals(document.components.messages.radioTrackPlaying.payload, {
		$ref: '#/components/schemas/connectInboxTrackPlaying',
	})
	assertEquals(document.components.messages.radioTrackNext.payload, {
		$ref: '#/components/schemas/connectInboxTrackNext',
	})
	assertEquals(document.components.messages.radioControl.payload, {
		$ref: '#/components/schemas/eventV1RadioControlPostBody',
	})
	assertEquals(document.components.messages.radioData.payload, {
		$ref: '#/components/schemas/eventV1RadioDataPostBody',
	})
	assertEquals(document.components.messages.validationFeedback.payload, {
		$ref: '#/components/schemas/validationFeedbackBody',
	})

	type EventSchema = { required?: string[]; properties: { created: { readOnly?: boolean } } }
	const controlSchema = document.components.schemas.eventV1RadioControlPostBody as EventSchema
	assertEquals(controlSchema.required, ['start', 'name', 'state', 'services', 'creator', 'created'])
	assertEquals(controlSchema.properties.created.readOnly, true)

	const dataSchema = document.components.schemas.eventV1RadioDataPostBody as EventSchema
	assertEquals(dataSchema.required, ['start', 'cycle', 'data', 'services', 'creator', 'created'])
	assertEquals(dataSchema.properties.created.readOnly, true)

	assertExists(document.components.schemas.servicesUrn)

	type TrackSchema = { required?: string[]; properties: { event: { const?: string }; created: { readOnly?: boolean } } }
	const playingSchema = document.components.schemas.connectInboxTrackPlaying as TrackSchema
	assertEquals(playingSchema.properties.event.const, 'de.ard.eventhub.v1.radio.track.playing')
	assertEquals(playingSchema.properties.created.readOnly, true)
	assertEquals(playingSchema.required?.includes('creator'), true)
	assertEquals(playingSchema.required?.includes('services'), true)

	const nextSchema = document.components.schemas.connectInboxTrackNext as TrackSchema
	assertEquals(nextSchema.properties.event.const, 'de.ard.eventhub.v1.radio.track.next')

	const feedbackSchema = document.components.schemas.validationFeedbackBody as { required?: string[] }
	assertEquals(feedbackSchema.required, ['created', 'institutionId', 'subject', 'errors', 'event'])
})
