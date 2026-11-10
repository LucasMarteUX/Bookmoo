import { Login } from './Login'

// Cadastro usa a mesma tela do login (ilustração à esquerda, formulário à direita).
export function SignUp() {
  return <Login mode="signup" />
}
