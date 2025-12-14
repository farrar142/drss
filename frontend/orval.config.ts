import { defineConfig } from 'orval';

export default defineConfig({
    api: {
        input: './openapi.json',
        output: {
            target: './app/services/api.ts',
            client: 'axios-functions',
            clean: true,
            override: {
                mutator: {
                    path: './app/utils/axiosInstance.ts',
                    name: 'axiosInstance',
                },
            },
        },
    },
});