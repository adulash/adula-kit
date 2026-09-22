import { createServer, type Socket, type AddressInfo } from 'node:net'

/** Loopback-only SMTP sink: exercises the real SMTP transport without external delivery. */
export async function smtpSink() {
  const messages: string[] = []
  const sockets = new Set<Socket>()
  const server = createServer((socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
    socket.on('error', () => {})
    socket.setEncoding('utf8')
    socket.write('220 localhost test SMTP\r\n')
    let buffer = ''
    let inData = false
    let lines: string[] = []
    socket.on('data', (chunk) => {
      buffer += chunk
      while (buffer.includes('\r\n')) {
        const end = buffer.indexOf('\r\n')
        const line = buffer.slice(0, end)
        buffer = buffer.slice(end + 2)
        if (inData) {
          if (line === '.') {
            messages.push(lines.join('\r\n'))
            lines = []
            inData = false
            socket.write('250 stored\r\n')
          } else lines.push(line.replace(/^\.\./, '.'))
        } else if (/^(EHLO|HELO) /i.test(line)) socket.write('250 localhost\r\n')
        else if (/^(MAIL FROM|RCPT TO|RSET|NOOP)/i.test(line)) socket.write('250 OK\r\n')
        else if (line === 'DATA') {
          inData = true
          socket.write('354 End with dot\r\n')
        } else if (line === 'QUIT') socket.end('221 Bye\r\n')
        else socket.write('502 Unsupported\r\n')
      }
    })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  return {
    port: (server.address() as AddressInfo).port,
    messages,
    close: async () => {
      for (const socket of sockets) socket.destroy()
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      )
    },
  }
}
