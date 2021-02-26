import { resolve } from 'path'
import * as vite from 'vite'
import { createVuePlugin } from 'vite-plugin-vue2'
import { ViteBuildContext } from './types'

export async function buildClient (ctx: ViteBuildContext) {
  const alias = {}
  for (const p of ctx.builder.plugins) {
    alias[p.name] = p.mode === 'server'
      ? `\0defaultexport:${resolve(ctx.nuxt.options.buildDir, 'empty.js')}`
      : `\0defaultexport:${p.src}`
  }

  const clientConfig: vite.InlineConfig = vite.mergeConfig(ctx.config, {
    define: {
      'process.server': false,
      'process.client': true,
      global: 'window',
      'module.hot': false
    },
    resolve: {
      alias
    },
    build: {
      outDir: 'dist/client',
      assetsDir: '.',
      rollupOptions: {
        input: resolve(ctx.nuxt.options.buildDir, 'client.js')
      }
    },
    plugins: [
      createVuePlugin()
    ],
    server: {
      middlewareMode: true
    }
  } as vite.InlineConfig)

  const viteServer = await vite.createServer(clientConfig)
  const viteMiddleware = (req, res, next) => {
    // Workaround: vite devmiddleware modifies req.url
    const originalURL = req.url
    if (req.url === '/_nuxt/client.js') {
      return res.end('')
    }
    viteServer.middlewares.handle(req, res, (err) => {
      req.url = originalURL
      next(err)
    })
  }
  await ctx.nuxt.callHook('server:devMiddleware', viteMiddleware)
  ctx.nuxt.hook('close', async () => {
    await viteServer.close()
  })
}
