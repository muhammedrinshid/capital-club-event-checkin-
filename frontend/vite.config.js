
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),

        VitePWA({
            registerType: 'autoUpdate',

            manifest: {
                name: 'My React App',
                short_name: 'MyApp',
                description: 'My React Progressive Web Application',
                start_url: '/',
                scope: '/',
                display: 'standalone',
                background_color: '#ffffff',
                theme_color: '#312ECB',

                icons: [
                    {
                        src: '/icons/icon-192.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'any'
                    },
                    {
                        src: '/icons/icon-512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any'
                    }
                ]
            }
        })
    ],

    server: {
        port: 5173
    }
    ,
    preview: {
        host: '0.0.0.0',
        port: 4173,
        allowedHosts: [
            'earn-were-phrases-stickers.trycloudflare.com'
        ]

    }

})
