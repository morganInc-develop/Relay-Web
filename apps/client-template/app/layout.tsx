import type { ServerFunctionClient } from "payload"
import { handleServerFunctions, RootLayout as PayloadRootLayout } from "@payloadcms/next/layouts"
import config from "@payload-config"
import "./globals.css"
import "@payloadcms/next/css"
import { importMap } from "./(payload)/admin/importMap.js"

const serverFunction: ServerFunctionClient = async function (args) {
  "use server"

  return handleServerFunctions({
    ...args,
    config,
    importMap,
  })
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <PayloadRootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
      {children}
    </PayloadRootLayout>
  )
}
