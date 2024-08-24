import { DateTimeFormatter, nativeJs } from '@js-joda/core';
import axios from 'axios';
import { NextFunction, Request, Response } from 'express';
import jsonwebtoken from 'jsonwebtoken';
import { config } from '../../config';
import { logger as log, logger } from '../../logger';

const fs = require('fs');
axios.interceptors.response.use((response) => {
  const headers = response.headers;
  if (headers && headers['x-correlation-id']) {
    const correlationId = headers['x-correlation-id'];
    logger.info(
      `${response.config.method.toUpperCase()} | ${response.config.url} | ${
        response.status
      } | ${correlationId}`,
    );
  } else {
    logger.info(
      `${response.config.method.toUpperCase()} | ${response.config.url} | ${
        response.status
      }`,
    );
  }

  return response;
});

const parseJwt = (token) => {
  try {
    return jsonwebtoken.decode(token);
  } catch (e) {
    logger.error(`Error parsing jwt: ${e}`);
    return null;
  }
};

let discovery = null;

async function getOidcDiscovery() {
  if (!discovery) {
    try {
      const response = await axios.get(config.get('oidc:discovery'));
      discovery = response.data;
    } catch (error) {
      log.error('getOidcDiscovery', `OIDC Discovery failed - ${error.message}`);
    }
  }
  return discovery;
}

async function getKeycloakPublicKey() {
  try {
    const response = await axios.get(
      config.get('oidc:keycloakUrl') + '/realms/standard',
    );
    const pubKey = response.data?.public_key;
    if (pubKey) {
      const soamFullPublicKey = `-----BEGIN PUBLIC KEY----- ${pubKey} -----END PUBLIC KEY-----`;
      const newline = '\n';
      return (
        soamFullPublicKey.substring(0, 26) +
        newline +
        soamFullPublicKey.substring(27, 91) +
        newline +
        soamFullPublicKey.substring(91, 155) +
        newline +
        soamFullPublicKey.substring(155, 219) +
        newline +
        soamFullPublicKey.substring(219, 283) +
        newline +
        soamFullPublicKey.substring(283, 346) +
        newline +
        soamFullPublicKey.substring(346, 411) +
        newline +
        soamFullPublicKey.substring(411, 420) +
        newline +
        soamFullPublicKey.substring(420)
      );
    }
  } catch (error) {
    log.error('getOidcDiscovery', `OIDC Discovery failed - ${error.message}`);
    throw error;
  }
}

function getSessionUser(req) {
  return req.session?.passport?.user;
}

async function postDataToDocGenService(
  body,
  url,
  correlationId,
  axiosConfig = {},
) {
  if (!axiosConfig['headers']) axiosConfig['headers'] = {};
  axiosConfig['headers']['x-correlation-id'] = correlationId;
  axiosConfig['headers']['x-api-key'] = config.get('docGenService:apiKey');
  return await postData(url, body, axiosConfig);
}

async function postData(url, body, axiosConfig) {
  try {
    const response = await axios.post(url, body, axiosConfig);
    return response.data;
  } catch (error) {
    log.error('postData', `POST failed - ${error.message}`);
    throw error;
  }
}

/*
  Updates multiple records in a single table with new values.
  This function exists because prisma does not offer a way to bulk update
  rows where each row is assigned a different value according its ID.
  The underlying RDBMS used for this project (Postgres) does support 
  this kind of bulk update, so this method builds a single Postgres
  statement to update multiple rows, and runs that statement with
  prisma's "raw query" functionality.
  Inspired by the code in these post: 
    - https://github.com/prisma/prisma/discussions/19765
    - https://stackoverflow.com/a/26715934

  Safety warning: This function does not "clean" any of the data values that 
  will be updated.  As such, this function should not be used to update any 
  values that were submitted directly by users (because there is a risk of 
  SQL injection attacks).  Instead, only use this function to update data 
  that is known to be clean (such as data that was derived on the backend).
  
  @param tx: a prisma transaction object
  @param updates: an array of objects of this format 
  {
    col_1_name: col_1_value,
    col_2_name: col_2_value,
    ...etc
  }
  @param typeHints: an object of this format:
    {colName: 'UUID'}, or {colName: 'TIMESTAMP'}
  which gives a hint about the data type that the value should be cast to
  Currently 'UUID' and 'TIMESTAMP' are the only supported typeHints.
  Type hints aren't necessary for dates because they can be inferred automatically
  @param tableName: name of the table to update
  @param primaryKeyCol: the name of the primary key column in the table 
  being updated (note: the primary key column must be one of the columns 
  specified in objects of the 'updates' array)
  */
async function updateManyUnsafe(
  tx,
  updates,
  typeHints = null,
  tableName: string,
  primaryKeyCol: string,
) {
  if (!updates.length) {
    return;
  }
  const supportedTypeHints = ['UUID', 'TIMESTAMP'];
  const targetAlias = 't';
  const srcAlias = 's';

  const colNames = Object.keys(updates[0]);

  // A simple function to format column values for use in a SQL
  // statement.
  //   javascript null => null
  //   javascript strings with type hints are wrapped in quotes then cast
  //   javascript strings (without type hints) are wrapped in single quotes
  //   javascript Dates are converted into an ISO8601 string and cast to TIMESTAMP
  //   javascript numbers, bools and other types are left "as is"
  const formatColValue = (v, typeHint = null) => {
    if (v === null) {
      return 'null';
    }
    if (supportedTypeHints.find((v) => v == typeHint)) {
      //column values of strings with a type hint of UUID should be cast to UUID
      return `'${v}'::${typeHint}`;
    }
    if (typeof v == 'string') {
      //column values of 'string' type should be quoted
      return `'${v}'`;
    }
    if (v instanceof Date) {
      //column values of 'Date' type should be converted to iso8601 strings.
      const isoDateStringUtc = nativeJs(v).format(
        DateTimeFormatter.ISO_INSTANT,
      );
      return `'${isoDateStringUtc}'::TIMESTAMP`;
    }
    return v;
  };

  if (typeHints == null) {
    typeHints = {};
  }

  // Create a list of statements which copy values from source columns to
  // target columns.
  const notPrimaryKey = (d) => d != primaryKeyCol;
  const setColumnStmts = colNames
    .filter(notPrimaryKey)
    .map((c) => `${c} = ${srcAlias}.${c}`);

  // Convert each item in the 'updates' list into a string of this format:
  // (col_1_value, col_2_value, ...)
  const valueTuples = updates.map(
    (u) =>
      '(' +
      colNames.map((c) => formatColValue(u[c], typeHints[c])).join(', ') +
      ')',
  );

  // Assemble a single SQL statement to update each row identified in the
  // "updates" array.
  const sql = `
    update ${tableName} as ${targetAlias} set
    ${setColumnStmts.join(',')}
    from (values
      ${valueTuples.join(',')}
    ) as ${srcAlias}(${colNames.join(',')})
    where ${targetAlias}.${primaryKeyCol}::text = ${srcAlias}.${primaryKeyCol}::text;
    `;

  await tx.$executeRawUnsafe(sql);
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const utils = {
  getOidcDiscovery,
  prettyStringify: (obj, indent = 2) => JSON.stringify(obj, null, indent),
  getSessionUser,
  getKeycloakPublicKey,
  postDataToDocGenService,
  postData,
  updateManyUnsafe,
  asyncHandler: (fn) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  },
  delay,
  parseJwt,
};

export { utils };
