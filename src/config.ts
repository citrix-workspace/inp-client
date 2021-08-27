import 'isomorphic-fetch'
import qs from 'qs'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import {Dictionary} from "./types";
import {getSuccessJson, getSuccessText} from "./lib/validation";

const config: {
    baseUrl?: string,
    customerId?: string,
    userId?: string,
    clientId?: string,
    clientSecret?: string,
    trustAuthUrl?: string,
    authToken?: string,
} = {}

export async function init(envFolder: string = '.', envName: string = '.env', withAuth: boolean = false) {
    const envPath = path.resolve(envFolder, envName)
    if (fs.existsSync(envPath)) {
        const result = dotenv.config({path: envPath})
        if (result.error) {
            throw new Error(`Cannot parse env from path=${envPath}: ${result.error}`)
        }
        console.log(`env variables loaded from ${envPath}`)
    } else {
        console.log(`.env file ${envPath} resolved from ${envName} does not exists. Skipping processing env variables using ${envName}.`)
    }

    const {
        INP_BASE_URL,
        CUSTOMER_ID,
        USER_ID,
        CLIENT_ID,
        CLIENT_SECRET,
        TRUST_AUTH_URL,
    }: Dictionary = process.env

    config.baseUrl = INP_BASE_URL
    config.customerId = CUSTOMER_ID
    config.userId = USER_ID
    config.clientId = CLIENT_ID
    config.clientSecret = CLIENT_SECRET
    config.trustAuthUrl = TRUST_AUTH_URL

    const argsJsonPath = path.join(envFolder, 'args.json')
    if (fs.existsSync(argsJsonPath)) {
        console.log(`args.json exists at ${argsJsonPath}, processing.`)
        const args = JSON.parse(fs.readFileSync(argsJsonPath).toString())
        overrideIfNotEmpty(config, args, 'userId')
        overrideIfNotEmpty(config, args, 'customerId')
        overrideIfNotEmpty(config, args, 'bearerToken')
    } else {
        console.log(`args.json does not exists at ${argsJsonPath}, skipping.`)
    }
    if (withAuth) {
        config.authToken = await fetchAuthToken()
    }
}

export function getBaseUrl(): string {
    return notEmpty(config, 'baseUrl')
}

export function getUserId(): string | undefined {
    return getValue(config, 'userId')
}

export function getCustomerId(): string {
    return notEmpty(config, 'customerId')
}

export function getClientId() {
    return notEmpty(config, 'clientId')
}

export function getClientSecret() {
    return notEmpty(config, 'clientSecret')
}

export function getTrustAuthUrl() {
    return notEmpty(config, 'trustAuthUrl')
}

export function getAuthToken() {
    return getValue(config, 'authToken')
}

function getValue(config: Dictionary, name: string): string | undefined {
    return config[name]
}

function notEmpty(config: Dictionary, name: string): string {
    const value = getValue(config, name)
    if (value === undefined) {
        throw new Error(`Value '${name}' is undefined`)
    }
    if (value === null) {
        throw new Error(`Value '${name}' is null`)
    }
    if (value.trim() === '') {
        throw new Error(`Value '${name}' is empty`)
    }
    return value
}

function overrideIfNotEmpty(config: Dictionary, args: Dictionary, name: string) {
    try {
        config[name] = notEmpty(args, name)
    } catch (ignored) {
    }
}

function fetchAuthToken(): Promise<string> {
    const options: RequestInit = {
        method: "POST",
        headers: {
            "content-type": "application/x-www-form-urlencoded",
            "Citrix-CustomerId": getCustomerId(),
        },
        body: qs.stringify({
            grant_type: "client_credentials",
            client_id: getClientId(),
            client_secret: getClientSecret(),
        }),
    };
    const url = `${getTrustAuthUrl()}/cctrustoauth2/${getCustomerId()}/tokens/clients`
    console.log(`Fetching token from ${url}, with payload=${options.body}`)
    return fetch(url, options)
        .then(getSuccessJson(new Error(`Can't get bearer token for ${getClientId()}`)))
        .then((responseBody) => responseBody.access_token);
}