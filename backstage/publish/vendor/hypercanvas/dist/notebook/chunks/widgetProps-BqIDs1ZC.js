import { s as schemas$1 } from "./tooltip-content-CaxwY_7M.js";
function readProp(props, key, schema) {
  const value = props?.[key];
  if (value !== void 0 && value !== null) {
    if (typeof value === "number" && Number.isNaN(value)) ;
    else {
      return value;
    }
  }
  return schema[key]?.defaultValue ?? null;
}
const schemas = schemas$1;
const stickyNoteSchema = schemas["sticky-note"];
schemas["markdown"];
const prototypeEmbedSchema = schemas["prototype"];
const linkPreviewSchema = schemas["link-preview"];
schemas["image"];
schemas["figma-embed"];
schemas["terminal"];
schemas["prompt"];
export {
  linkPreviewSchema as l,
  prototypeEmbedSchema as p,
  readProp as r,
  stickyNoteSchema as s
};
