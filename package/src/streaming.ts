import type { StreamingResult } from './specs/StreamingResult.nitro'
import type { QueryResult } from './specs/QueryResult.nitro'

export async function* streamChunks(
  stream: StreamingResult
): AsyncIterableIterator<QueryResult> {
  try {
    while (true) {
      const chunk = await stream.fetchChunk()
      if (chunk === undefined || chunk === null) break
      yield chunk
    }
  } finally {
    stream.close()
  }
}
