import styles from './userDialogs.module.css'

let nextDialogId = 0

/** HTML dialogs work in both browsers and sandboxed Electron renderers. */
function openDialog({ title, message, initialValue, submitLabel }) {
  return new Promise(resolve => {
    const previousFocus = document.activeElement
    const dialog = document.createElement('dialog')
    dialog.className = styles.dialog
    const heading = document.createElement('h2')
    heading.id = `sb-user-dialog-${++nextDialogId}`
    heading.textContent = title
    dialog.setAttribute('aria-labelledby', heading.id)
    const form = document.createElement('form')
    form.method = 'dialog'
    form.append(heading)
    if (message) {
      const description = document.createElement('p')
      description.className = styles.message
      description.textContent = message
      description.id = `${heading.id}-description`
      dialog.setAttribute('aria-describedby', description.id)
      form.append(description)
    }
    let input
    if (initialValue !== undefined) {
      input = document.createElement('input')
      input.type = 'text'
      input.value = initialValue
      input.setAttribute('aria-label', title)
      input.autofocus = true
      form.append(input)
    }
    const actions = document.createElement('div')
    actions.className = styles.actions
    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.textContent = 'Cancel'
    cancel.addEventListener('click', () => dialog.close())
    const submit = document.createElement('button')
    submit.type = 'submit'
    submit.textContent = submitLabel
    submit.className = styles.submit
    // Destructive confirmations default focus to Cancel.
    if (!input) cancel.autofocus = true
    const updateValidity = () => { submit.disabled = Boolean(input && !input.value.trim()) }
    input?.addEventListener('input', updateValidity)
    updateValidity()
    actions.append(cancel, submit)
    form.append(actions)
    form.addEventListener('submit', event => {
      event.preventDefault()
      if (!submit.disabled) dialog.close('accept')
    })
    dialog.append(form)
    dialog.addEventListener('close', () => {
      const result = dialog.returnValue === 'accept' ? (input ? input.value : true) : (input ? null : false)
      dialog.remove()
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
      resolve(result)
    }, { once: true })
    document.body.append(dialog)
    dialog.showModal()
    input?.select()
  })
}

export function requestText(title, initialValue = '', { submitLabel = 'Save' } = {}) {
  return openDialog({ title, initialValue, submitLabel })
}

export function requestConfirmation(message, { title = 'Delete page?', submitLabel = 'Delete' } = {}) {
  return openDialog({ title, message, submitLabel })
}
