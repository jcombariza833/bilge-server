const { queries } = require("./queries");
const { schema } = require("./schema");

const typeDefs = [queries, schema];

module.exports = {
  typeDefs,
};