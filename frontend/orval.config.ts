import { defineConfig } from 'orval';

export default defineConfig({
    api: {
        input: './openapi.json',
        output: {
            target: './src/app/services/api.ts',
            client: 'axios-functions',
            clean: true,
            override: {
                mutator: {
                    path: './src/app/utils/axiosInstance.ts',
                    name: 'axiosInstance',
                },
            },
        },
    },
});