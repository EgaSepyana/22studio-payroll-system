export function validateBody(schema) {
  return (req, res, next) => {
    req.body = schema.parse(req.body);
    next();
  };
}

// Express 5 exposes req.query as a getter-only property, so parsed query
// values are attached under req.validatedQuery instead of reassigning it.
export function validateQuery(schema) {
  return (req, res, next) => {
    req.validatedQuery = schema.parse(req.query);
    next();
  };
}
