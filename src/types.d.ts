export type Dictionary = {
    [key: string]: any
}

export interface EndpointScript {
    scriptName: string,
    functionName: string,
    endpointScriptType: "onExecution"
}

export interface EndpointsDefinition {
            name: string,
            httpMethod: "Post" | "Put" | "Get" | "Delete",
            endpointType: "onDemand",
            category: string,
            endpointScripts: EndpointScript[]
}

export type EndpointsDefinitions = EndpointsDefinition[]