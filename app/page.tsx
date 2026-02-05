// app/page.tsx
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-4">WhatsApp Product Catalog Bot</h1>
      <p className="text-lg mb-8">The bot is running in the background</p>
      <div className="bg-gray-100 p-6 rounded-lg max-w-md">
        <h2 className="text-xl font-semibold mb-2">API Endpoints:</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li><code>GET /api/whatsapp/webhook</code> - Verification</li>
          <li><code>POST /api/whatsapp/webhook</code> - Message handling</li>
        </ul>
      </div>
    </main>
  )
}