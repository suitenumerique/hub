import { MatrixUserInterface } from '../types';

const MATRIX_USER_KEY = 'matrixUser';
class MatrixUserStore {
  getUser(): MatrixUserInterface | null {
    const data = localStorage.getItem(MATRIX_USER_KEY);
    return data ? JSON.parse(data) : null;
  }

  saveUser(localUser: MatrixUserInterface) {
    localStorage.setItem(MATRIX_USER_KEY, JSON.stringify(localUser));
  }

  removeUser() {
    localStorage.removeItem(MATRIX_USER_KEY);
  }
}

export const matrixUserStore = new MatrixUserStore();
