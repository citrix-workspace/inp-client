# inp-client

Integration platform API client

## Setup and creating demo integration

1. run `npm i` to install dependencies
1. copy `.env.example` to `.env` and update to your values, keep as is for local development
1. copy `examples/on-demand-endpoint` to your destination, note that folder `local` is in `.gitignore` so you can copy it here: `cp -R examples/on-demand-endpoint local`   
1. create a demo integration with `npm run inp-client -- -c local/on-demand-endpoint`
1. see file created: `local/on-demand-endpoint/created-integration.json` which contains all created resources

## Updating scripts

1. change something in `local/scripts/hello-world.js`, modify result or add logging
1. run `npm run inp-client -- -u local/on-demand-endpoint/`, it will load saved integration `created-integration.json` and lookup for endpoints and scripts and will update all found.

