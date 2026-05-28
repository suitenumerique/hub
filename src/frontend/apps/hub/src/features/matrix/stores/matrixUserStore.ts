import { CHAT_USER_LISTENER_KEY } from "@/features/drivers/implementations/MatrixDriver";
import { MatrixUserInterface } from "../types";

const MATRIX_USER_KEY = 'matrixUser';
const OIDC_CLIENT_ID = 'oidc_client_id';
const OIDC_ISSUER = 'oidc_issuer';
const OIDC_ID_TOKEN = 'oidc_id_token';


class MatrixUserStore {
  getUser(): MatrixUserInterface | null {
    const data = localStorage.getItem(MATRIX_USER_KEY);
    return data ? JSON.parse(data) : null;
  }

  saveUser(localUser: MatrixUserInterface) {
    localStorage.setItem(MATRIX_USER_KEY, JSON.stringify(localUser));
    window.dispatchEvent(
      new CustomEvent(CHAT_USER_LISTENER_KEY, {
        detail: localUser
      })
    );
  }

  removeUser() {
    localStorage.removeItem(MATRIX_USER_KEY);
    localStorage.removeItem(OIDC_CLIENT_ID);
    localStorage.removeItem(OIDC_ISSUER);
    localStorage.removeItem(OIDC_ID_TOKEN);
  }

  persistOIDC(clientId: string, tokenIssuer: string, idToken: string) {
    localStorage.setItem(OIDC_CLIENT_ID, clientId);
    localStorage.setItem(OIDC_ISSUER, tokenIssuer);
    localStorage.setItem(OIDC_ID_TOKEN, idToken);
  }
}

export const matrixUserStore = new MatrixUserStore();
