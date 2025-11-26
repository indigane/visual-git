// Support CSS module imports in TypeScript type checker
declare module "*.css" {
  const stylesheet: CSSStyleSheet;
  export default stylesheet;
}
