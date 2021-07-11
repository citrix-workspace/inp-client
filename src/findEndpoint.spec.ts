import integration from '../examples/on-demand-endpoint/created-integration.json'

describe('first test', () => {
    it('first test', () => {
        console.log(`Endpoints ${JSON.stringify(integration.endpointDefinitions)}`)
    })
})