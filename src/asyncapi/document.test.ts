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
	const radioControl = document.channels.radioLivestreamControl
	const radioData = document.channels.radioLivestreamData
	assertExists(inbox)
	assertEquals(inbox.address, 'inbox/{institutionId}')
	assertEquals(inbox.title, 'inbox/{institutionId}')
	assertEquals(radioControl.address, 'radio/{livestreamId}/control')
	assertEquals(radioControl.title, 'radio/{livestreamId}/control')
	assertEquals(radioData.address, 'radio/{livestreamId}/data')
	assertEquals(radioData.title, 'radio/{livestreamId}/data')

	assertEquals(document.operations.sendRadioControl.action, 'send')
	assertEquals(document.operations.sendRadioControl.channel.$ref, '#/channels/inboxInstitution')
	assertEquals(document.operations.sendRadioData.action, 'send')
	assertEquals(document.operations.receiveRadioControl.action, 'receive')
	assertEquals(document.operations.receiveRadioControl.channel.$ref, '#/channels/radioLivestreamControl')
	assertEquals(document.operations.receiveRadioData.action, 'receive')
	assertEquals(document.operations.sendRadioControl.title, 'Publish radio.control on inbox/{institutionId}')

	assertEquals(document.components.messages.radioControl.payload, {
		$ref: '#/components/schemas/eventV1RadioControlPostBody',
	})
	assertEquals(document.components.messages.radioData.payload, {
		$ref: '#/components/schemas/eventV1RadioDataPostBody',
	})

	type EventSchema = { required?: string[]; properties: { created: { readOnly?: boolean } } }
	const controlSchema = document.components.schemas.eventV1RadioControlPostBody as EventSchema
	assertEquals(controlSchema.required, ['start', 'name', 'state', 'services', 'creator', 'created'])
	assertEquals(controlSchema.properties.created.readOnly, true)

	const dataSchema = document.components.schemas.eventV1RadioDataPostBody as EventSchema
	assertEquals(dataSchema.required, ['start', 'cycle', 'data', 'services', 'creator', 'created'])
	assertEquals(dataSchema.properties.created.readOnly, true)

	assertExists(document.components.schemas.servicesUrn)
})
