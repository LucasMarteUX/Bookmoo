import { useState } from 'react'
import { KeyRound, Check, Loader2, ExternalLink, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InfoHint } from '@/components/ui/info-hint'
import { Input } from '@/components/ui/input'
import { aiKeyErrorMessage, connectAiKey, removeAiKey, useAiStatus, type AiProvider } from '@/lib/aiKeys'

const PROVIDERS: { id: AiProvider; name: string; usage: string; keyUrl: string; placeholder: string }[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    usage: 'Recomendado para gerar as imagens dos quadrinhos (custo baixo por página).',
    keyUrl: 'https://platform.openai.com/api-keys',
    placeholder: 'sk-...',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    usage: 'Recomendado para explicações, transcrição de páginas e para posicionar o texto nos balões.',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    placeholder: 'AIza...',
  },
]

/** Cada usuário conecta a própria chave. Ela é validada e guardada cifrada no servidor. */
export function AiConnections() {
  const { status, loading } = useAiStatus()
  const [drafts, setDrafts] = useState<Record<AiProvider, string>>({ openai: '', gemini: '' })
  const [busy, setBusy] = useState<AiProvider | null>(null)
  const [errors, setErrors] = useState<Partial<Record<AiProvider, string>>>({})

  const connect = async (p: AiProvider) => {
    setBusy(p)
    setErrors((e) => ({ ...e, [p]: undefined }))
    try {
      await connectAiKey(p, drafts[p].trim())
      setDrafts((d) => ({ ...d, [p]: '' }))
    } catch (e) {
      setErrors((er) => ({ ...er, [p]: aiKeyErrorMessage((e as Error).message) }))
    } finally {
      setBusy(null)
    }
  }

  const remove = async (p: AiProvider) => {
    setBusy(p)
    try { await removeAiKey(p) } catch { setErrors((er) => ({ ...er, [p]: 'Não foi possível remover a chave.' })) } finally { setBusy(null) }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-[15px] font-semibold flex items-center gap-2 mb-3" style={{ color: 'var(--theme-text)' }}>
        <KeyRound className="w-5 h-5" />
        Conexões de IA
        <InfoHint title="Por que conectar uma chave?" faq="chave-ia">
          Explicações, histórias e imagens usam a sua chave da OpenAI ou do Gemini. Ela fica cifrada no servidor e só é usada nos seus pedidos.
        </InfoHint>
      </h2>
      <div className="p-5 rounded-2xl border transition-colors space-y-5" style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-border)' }}>
        <p className="text-sm flex gap-2" style={{ color: 'var(--theme-text-secondary)' }}>
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Conecte sua própria chave para gerar quadrinhos e usar as explicações com IA. Os custos vão para a sua conta no provedor.
            A chave é validada, guardada cifrada no servidor e nunca volta para o navegador.
          </span>
        </p>

        {loading && (
          <p className="text-sm flex items-center gap-2" style={{ color: 'var(--theme-text-secondary)' }}>
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
          </p>
        )}

        {status && PROVIDERS.map((p) => {
          const st = status[p.id]
          return (
            <div key={p.id} className="p-4 rounded-2xl border space-y-3" style={{ borderColor: 'var(--theme-border-subtle)', backgroundColor: 'var(--theme-bg)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold flex items-center gap-2" style={{ color: 'var(--theme-text)' }}>
                    {p.name}
                    {st.connected && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        <Check className="w-3 h-3" /> Conectada · {st.hint}
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--theme-text-secondary)' }}>{p.usage}</p>
                </div>
                <a href={p.keyUrl} target="_blank" rel="noopener noreferrer" className="text-xs flex items-center gap-1 shrink-0 hover:underline" style={{ color: 'var(--theme-accent)' }}>
                  Obter chave <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={drafts[p.id]}
                  onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                  placeholder={st.connected ? 'Colar uma nova chave para substituir' : p.placeholder}
                  className="rounded-xl flex-1"
                  aria-label={`Chave da ${p.name}`}
                />
                <Button
                  className="rounded-xl"
                  style={{ backgroundColor: 'var(--theme-primary)', color: 'var(--theme-primary-text)' }}
                  disabled={busy === p.id || drafts[p.id].trim().length < 20}
                  onClick={() => connect(p.id)}
                >
                  {busy === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : st.connected ? 'Substituir' : 'Conectar'}
                </Button>
                {st.connected && (
                  <Button variant="outline" className="rounded-xl" disabled={busy === p.id} onClick={() => remove(p.id)}>
                    Remover
                  </Button>
                )}
              </div>
              {errors[p.id] && <p className="text-sm text-[var(--pastel-rose-fg)]">{errors[p.id]}</p>}
            </div>
          )
        })}

        <p className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
          A Anthropic (Claude) não gera imagens, por isso não aparece aqui. Com as duas chaves conectadas, o Bookmoo usa a OpenAI para as imagens e o Gemini para o texto.
        </p>
      </div>
    </section>
  )
}
