// src/apollo/client.js
import {
  ApolloClient,
  InMemoryCache,
  split,
  createHttpLink,
  from,
} from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';
import { setContext } from '@apollo/client/link/context';
import { RetryLink } from '@apollo/client/link/retry';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onError } from '@apollo/client/link/error';

// Log GraphQL + network errors
const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(err => {
      console.error('GraphQL Error:', err);
    });
  }
  if (networkError) {
    console.error('Network Error:', networkError);
  }
});

// 👉 use your dev tunnel / API URL here
const httpLink = createHttpLink({ uri: 'https://api.safetycamai.com/graphql/' });
// const httpLink = createHttpLink({
//   uri: 'https://q6nxq1m6-7245.inc1.devtunnels.ms/graphql/',
// });

//  Attach Authorization + MFA token like Vue auth.interceptor
const authLink = setContext(async (_, { headers }) => {
  const accessToken = await AsyncStorage.getItem("accessToken");
  const mfaToken = await AsyncStorage.getItem("mfaToken");

  return {
    headers: {
      ...headers,
      authorization: accessToken
        ? `Bearer ${accessToken}`
        : mfaToken
        ? `Bearer ${mfaToken}`
        : "",
    },
  };
});



const retryHttpLink = new RetryLink({
  delay: { initial: 500, max: 5000, jitter: true },
  attempts: (count, _op, error) => !!error && count <= 5,
});

// WebSocket for subscriptions (no MFA needed here usually)
const wsClient = createClient({
  url: 'wss://api.safetycamai.com/graphql/',
  // url: 'wss://q6nxq1m6-7245.inc1.devtunnels.ms/graphql/',
  lazy: true,
  keepAlive: 12000,
  retryAttempts: Infinity,
  retryWait: async retries =>
    new Promise(res =>
      setTimeout(res, Math.min(1000 * 2 ** retries, 10000)),
    ),
  shouldRetry: () => true,
  connectionParams: async () => {
    const accessToken = await AsyncStorage.getItem('accessToken');
    return {
      authorization: accessToken ? `Bearer ${accessToken}` : '',
    };
  },
});

const wsLink = new GraphQLWsLink(wsClient);

const splitLink = split(
  ({ query }) => {
    const def = getMainDefinition(query);
    return def.kind === 'OperationDefinition' && def.operation === 'subscription';
  },
  wsLink,
  from([errorLink, retryHttpLink, authLink, httpLink]),
);

export const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
});





// // apollo/client.ts
// import { ApolloClient, InMemoryCache, split, createHttpLink, from } from '@apollo/client';
// import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
// import { createClient } from 'graphql-ws';
// import { getMainDefinition } from '@apollo/client/utilities';
// import { setContext } from '@apollo/client/link/context';
// import { RetryLink } from '@apollo/client/link/retry';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import { onError } from '@apollo/client/link/error';

// const errorLink = onError(({ graphQLErrors, networkError }) => {
//   if (graphQLErrors) graphQLErrors.forEach(err =>
//     console.error("GraphQL Error:", err)
//   );
//   if (networkError) console.error("Network Error:", networkError);
// });


// //const httpLink = createHttpLink({ uri: 'https://api.safetycamai.com/graphql/' });
// const httpLink = createHttpLink({ uri: 'https://q6nxq1m6-7245.inc1.devtunnels.ms/graphql/' });

// const authLink = setContext(async (_, { headers }) => {
//   const token = await AsyncStorage.getItem('accessToken');
//   const mfaToken = await AsyncStorage.getItem('mfaToken'); // transient MFA token
//   return {
//     headers: {
//       ...headers,
//       authorization: token ? `Bearer ${token}` : '',
//       ...(mfaToken ? { 'x-mfa-token': mfaToken } : {}),
//     },
//   };
// })

// const retryHttpLink = new RetryLink({
//   delay: { initial: 500, max: 5000, jitter: true },
//   attempts: (count, _op, error) => !!error && count <= 5,
// });

// // const errorLink = onError(({ networkError }) => {
// //   if (networkError) console.log('[GraphQL network error]', networkError);
// // });

// const wsClient = createClient({
//   //url: 'wss://api.safetycamai.com/graphql/',
// url: 'wss://q6nxq1m6-7245.inc1.devtunnels.ms/graphql/',
//   lazy: true,
//   keepAlive: 12000,                               // send ping every 12s
//   retryAttempts: Infinity,
//   retryWait: async (retries) =>
//     new Promise((res) => setTimeout(res, Math.min(1000 * 2 ** retries, 10000))), // exp backoff
//   shouldRetry: () => true,
//   connectionParams: async () => {
//     const token = await AsyncStorage.getItem('accessToken');
//     return { authorization: token ? `Bearer ${token}` : '' };
//   },
// });

// const wsLink = new GraphQLWsLink(wsClient);

// const splitLink = split(
//   ({ query }) => {
//     const def = getMainDefinition(query);
//     return def.kind === 'OperationDefinition' && def.operation === 'subscription';
//   },
//   wsLink,
//   from([errorLink, retryHttpLink, authLink, httpLink])
// );

// export const client = new ApolloClient({
//   link: splitLink,
//   cache: new InMemoryCache(),
// });





