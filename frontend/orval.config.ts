import { defineConfig } from 'orval';

export default defineConfig({
    api: {
        input: './openapi.json',
        output: {
            target: './src/services/api.ts',
            client: 'axios-functions',
            clean: true,
            override: {
                mutator: {
                    path: './src/utils/axiosInstance.ts',
                    name: 'axiosInstance',
                },
            },
        },
    },
});
