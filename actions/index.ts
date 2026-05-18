import { registerUserAction, loginUserAction, logoutAction } from "./auth";

export const actions = {
  auth: {
    registerUserAction,
    loginUserAction,
    logoutAction,
  },
};
