import { useId, useState, useSyncExternalStore } from 'react'
import { useWords } from '../text/words.ts'
import { checkAddress, hostOf, type AddressRefusal } from './address.ts'
import { PROVIDERS, type ProviderId } from './providers.ts'
import { keyEnding, type SetupKeeper } from './setup.ts'

/**
 * The setup card (docs/spec-v1.md section 8, Math assistant, The setup card;
 * its words are section 13's): the provider, the address for a typed one, the
 * key, the model, the four lines for the provider chosen, Save and Forget this
 * setup. Nothing here makes a request: Save only keeps the setup, and Show
 * models and Check key have their places and send nothing until they are
 * built (issue 5 of the slice).
 *
 * The key is in this file only as the field's own value, between a paste and
 * Save. Once saved it is never shown again: only its last four characters.
 */
type Choice = ProviderId | 'other'
type Refusal = AddressRefusal | 'keySpaces' | 'noModel'

const builtIn = (choice: Choice) => PROVIDERS.find(({ id }) => id === choice)

export function SetupCard({ keeper, vault }: { keeper: SetupKeeper; /** In Obsidian: where the key is kept differs. */ vault: boolean }) {
  const w = useWords().assistant
  const { setup, session, removed } = useSyncExternalStore(keeper.subscribe, keeper.state)

  const [provider, setProvider] = useState<Choice>(setup?.provider ?? PROVIDERS[0].id)
  const [address, setAddress] = useState(setup?.provider === 'other' ? setup.address : '')
  const [model, setModel] = useState(setup ? setup.model : (PROVIDERS[0].defaultModel ?? ''))
  const [key, setKey] = useState('')
  const [shown, setShown] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const [refusal, setRefusal] = useState<Refusal | null>(null)
  /** The provider picked while a key is saved, until Cancel or Change. */
  const [pending, setPending] = useState<Choice | null>(null)

  // A label holds its field only: a button inside it would be read as part of the field's name.
  const keyLabel = useId()
  const modelLabel = useId()

  const chosen = builtIn(provider)
  const host = chosen ? new URL(chosen.address).host : hostOf(address)
  /** The saved key stands: the field gives way to its last four characters. */
  const kept = setup !== null && setup.key !== '' && !replacing
  // A built-in needs a key; a typed address may have none, for a local model.
  const canSave = kept || provider === 'other' || key.trim() !== ''

  const choose = (choice: Choice) => {
    setProvider(choice)
    setAddress('')
    setModel(builtIn(choice)?.defaultModel ?? '')
    setKey('')
    setShown(false)
    setReplacing(false)
    setRefusal(null)
    setPending(null)
  }

  const save = () => {
    let keptAddress: string
    if (chosen) keptAddress = chosen.address
    else {
      const check = checkAddress(address)
      if (!check.ok) return setRefusal(check.reason)
      keptAddress = check.address
    }
    const typed = key.trim()
    if (!kept && /\s/.test(typed)) return setRefusal('keySpaces')
    const name = model.trim()
    if (!name) return setRefusal('noModel')
    keeper.save({ provider, address: keptAddress, model: name, key: kept ? setup.key : typed, hosts: setup?.hosts ?? [] })
    setAddress(chosen ? '' : keptAddress)
    setModel(name)
    setKey('')
    setShown(false)
    setReplacing(false)
    setRefusal(null)
  }

  return (
    <div className="assistant-card">
      {removed && (
        <p className="assistant-card__heading" role="status">
          {w.keyRemoved}
        </p>
      )}
      <p className="assistant-card__about">{w.about}</p>

      <label className="assistant-card__field">
        <span>{w.provider}</span>
        <select
          value={pending ?? provider}
          onChange={(event) => {
            const choice = event.target.value as Choice
            // One setup at a time: with a key saved, another provider asks first.
            if (setup !== null && setup.key !== '' && choice !== setup.provider) setPending(choice)
            else choose(choice)
          }}
        >
          {PROVIDERS.map(({ id, name }) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
          <option value="other">{w.other}</option>
        </select>
      </label>

      {pending && setup && (
        <div className="assistant-card__confirm" role="alertdialog" aria-label={w.change(hostOf(setup.address) ?? '')}>
          <p>{w.change(hostOf(setup.address) ?? '')}</p>
          <div className="assistant-card__actions">
            <button type="button" className="assistant-card__button" onClick={() => setPending(null)}>
              {w.cancel}
            </button>
            <button
              type="button"
              className="assistant-card__button is-primary"
              onClick={() => {
                keeper.forget()
                choose(pending)
              }}
            >
              {w.changeProvider}
            </button>
          </div>
        </div>
      )}

      {!chosen && (
        <label className="assistant-card__field">
          <span>{w.address}</span>
          <input
            type="text"
            value={address}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={refusal === 'notUrl' || refusal === 'notHttps' || refusal === 'credentials'}
            onChange={(event) => {
              setAddress(event.target.value)
              setRefusal(null)
            }}
          />
        </label>
      )}

      {kept ? (
        <div className="assistant-card__field" role="group" aria-labelledby={keyLabel}>
          <span id={keyLabel}>{w.key}</span>
          <span className="assistant-card__saved">
            <span data-testid="assistant-saved-key">
              {session === null ? w.savedKey(keyEnding(setup.key)) : w.sessionKey(keyEnding(setup.key))}
            </span>
            <span className="assistant-card__actions">
              <button type="button" className="assistant-card__button" onClick={() => setReplacing(true)}>
                {w.replace}
              </button>
              <button
                type="button"
                className="assistant-card__button"
                onClick={() => {
                  keeper.removeKey()
                  setRefusal(null)
                }}
              >
                {w.remove}
              </button>
            </span>
          </span>
        </div>
      ) : (
        <div className="assistant-card__field">
          <span id={keyLabel}>{w.key}</span>
          <span className="assistant-card__row">
            <input
              aria-labelledby={keyLabel}
              type={shown ? 'text' : 'password'}
              value={key}
              spellCheck={false}
              autoComplete="off"
              aria-invalid={refusal === 'keySpaces'}
              onChange={(event) => {
                setKey(event.target.value)
                setRefusal(null)
              }}
            />
            <button
              type="button"
              className="assistant-card__button is-eye"
              aria-label={shown ? w.hideKey : w.showKey}
              title={shown ? w.hideKey : w.showKey}
              aria-pressed={shown}
              onClick={() => setShown(!shown)}
            >
              <Eye open={!shown} />
            </button>
          </span>
        </div>
      )}

      <div className="assistant-card__field">
        <span id={modelLabel}>{w.model}</span>
        <span className="assistant-card__row is-wrapping">
          <input
            aria-labelledby={modelLabel}
            type="text"
            value={model}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={refusal === 'noModel'}
            onChange={(event) => {
              setModel(event.target.value)
              setRefusal(null)
            }}
          />
          {/* Its place: it asks the provider for its list, only when pressed, once it is built. */}
          <button type="button" className="assistant-card__button" disabled>
            {w.showModels}
          </button>
        </span>
      </div>

      <ul className="assistant-card__lines">
        <li>{w.cost[provider]}</li>
        {host && <li>{w.keeps(host)}</li>}
        <li>{vault ? w.keptVault : w.keptWeb}</li>
        {host && <li>{w.confidential(host)}</li>}
      </ul>

      {session !== null && (
        <p className="assistant-card__problem" role="alert">
          {vault ? w.cantKeepVault : w.cantKeepWeb} {session}
        </p>
      )}
      {refusal && (
        <p className="assistant-card__problem" role="alert">
          {w.refused[refusal]}
        </p>
      )}

      <div className="assistant-card__actions">
        <button type="button" className="assistant-card__button is-primary" disabled={!canSave} onClick={save}>
          {w.save}
        </button>
        {/* Its place: the same request as Show models, pressed for another reason. */}
        <button type="button" className="assistant-card__button" disabled>
          {w.checkKey}
        </button>
      </div>
      {setup && (
        <button
          type="button"
          className="assistant-card__link"
          onClick={() => {
            keeper.forget()
            choose(PROVIDERS[0].id)
          }}
        >
          {w.forget}
        </button>
      )}
    </div>
  )
}

/** The eye: open while the key is masked (press to show it), struck through while it shows. */
function Eye({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
      {!open && <path d="M4 4l16 16" />}
    </svg>
  )
}
