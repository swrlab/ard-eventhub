import { z } from 'zod'

/**
 * Deployment stage.
 * @see https://github.com/swrlab/ard-eventhub/blob/main/docs/STAGES.md
 */
export const stage = z.enum(['dev', 'prod', 'test'])

const liveradioCredential = z.object({
	coreId: z.string(),
	username: z.string(),
	password: z.string(),
	api_key: z.string(),
})

const liveRadioEndpoint = z.object({
	dev: z.string(),
	test: z.string(),
	beta: z.string(),
	prod: z.string(),
})

/**
 * DTS integration keys loaded from env.
 */
export const dtsKeys = z.object({
	credentials: z.object({
		dashboardToken: z.string(),
		liveradio: z.array(liveradioCredential),
	}),
	endpoints: z.object({
		listIntegrationRecords: z.string(),
		searchBroadcasts: z.string(),
		liveRadioEvent: liveRadioEndpoint,
	}),
	integrationName: z.string(),
	permittedExcludedFields: z.object({
		media: z.string(),
	}),
})

/**
 * Radioplayer API key map loaded from env.
 */
export const radioplayerApiKeys = z.record(z.string(), z.string())

/**
 * DTS LiveRadio event payload (fields nullable because excludeFields can strip them).
 */
export const liveRadioEvent = z.object({
	broadcastId: z.string().nullable(),
	contentId: z.string().nullable(),
	type: z.string().nullable(),
	status: z.string().nullable(),
	client: z.string().nullable(),
	clientVersion: z.string().nullable(),
	timestamp: z.string().nullable(),
	artist: z.string().nullable(),
	title: z.string().nullable(),
	isrc: z.string().nullable(),
	email: z.string().nullable(),
	duration: z.number().nullable(),
	delay: z.number().nullable(),
	album: z.string().nullable(),
	composer: z.string().nullable(),
	program: z.string().nullable(),
	subject: z.string().nullable(),
	webURL: z.string().nullable(),
	enableShare: z.boolean().nullable(),
	enableThumbs: z.boolean().nullable(),
	year: z.number().nullable(),
	fccId: z.string().nullable(),
	imageURL: z.string().nullable(),
})

/**
 * Single allow-listed Eventhub user from `src/config/users-$stage.json`.
 */
export const configUser = z.object({
	email: z.string(),
	institutionId: z.string(),
	institution: z.string(),
})

/**
 * Users allow-list file shape.
 */
export const usersConfig = z.object({
	users: z.array(configUser),
})

/**
 * Livestream topic that may be published even though it is absent from the ARD feed.
 * @see docs/ids/common-ids.md
 */
export const allowedLivestream = z.object({
	id: z.string(),
	name: z.string(),
	publisherId: z.string(),
})

/**
 * Allow-list of COMMON_IDS nightly topics (`src/config/allowed-livestreams.json`).
 */
export const allowedLivestreamsConfig = z.object({
	note: z.string(),
	livestreams: z.array(allowedLivestream),
})

export type Stage = z.infer<typeof stage>
export type LiveradioCredential = z.infer<typeof liveradioCredential>
export type DTSKeys = z.infer<typeof dtsKeys>
export type RadioplayerApiKeys = z.infer<typeof radioplayerApiKeys>
export type LiveRadioEvent = z.infer<typeof liveRadioEvent>
export type PermittedExcludedFields = DTSKeys['permittedExcludedFields']
export type ConfigUser = z.infer<typeof configUser>
export type AllowedLivestream = z.infer<typeof allowedLivestream>
export type AllowedLivestreamsConfig = z.infer<typeof allowedLivestreamsConfig>
