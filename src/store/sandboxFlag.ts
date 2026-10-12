/**
 * True while a render sandbox (variants, Quick, Project) puts the user's
 * project back. The route must not read that restore as the user switching
 * modes: the screen they navigated to wins.
 */
export const sandbox = { restoring: false };
