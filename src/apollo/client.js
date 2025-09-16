// apollo/client.ts
import { ApolloClient, InMemoryCache, split, createHttpLink, from } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';
import { setContext } from '@apollo/client/link/context';
import { RetryLink } from '@apollo/client/link/retry';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onError } from '@apollo/client/link/error';

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) graphQLErrors.forEach(err =>
    console.error("GraphQL Error:", err)
  );
  if (networkError) console.error("Network Error:", networkError);
});


const httpLink = createHttpLink({ uri: 'https://api.safetycamai.com/graphql/' });

const authLink = setContext(async (_, { headers }) => {
  const token = await AsyncStorage.getItem('accessToken');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

const retryHttpLink = new RetryLink({
  delay: { initial: 500, max: 5000, jitter: true },
  attempts: (count, _op, error) => !!error && count <= 5,
});

// const errorLink = onError(({ networkError }) => {
//   if (networkError) console.log('[GraphQL network error]', networkError);
// });

const wsClient = createClient({
  url: 'wss://api.safetycamai.com/graphql/',
  lazy: true,
  keepAlive: 12000,                               // send ping every 12s
  retryAttempts: Infinity,
  retryWait: async (retries) =>
    new Promise((res) => setTimeout(res, Math.min(1000 * 2 ** retries, 10000))), // exp backoff
  shouldRetry: () => true,
  connectionParams: async () => {
    const token = await AsyncStorage.getItem('accessToken');
    return { authorization: token ? `Bearer ${token}` : '' };
  },
});

const wsLink = new GraphQLWsLink(wsClient);

const splitLink = split(
  ({ query }) => {
    const def = getMainDefinition(query);
    return def.kind === 'OperationDefinition' && def.operation === 'subscription';
  },
  wsLink,
  from([errorLink, retryHttpLink, authLink, httpLink])
);

export const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
});







// import { ApolloClient, InMemoryCache, split, createHttpLink } from '@apollo/client';
// import { WebSocketLink } from '@apollo/client/link/ws';
// import { getMainDefinition } from '@apollo/client/utilities';
// import { setContext } from '@apollo/client/link/context';
// import AsyncStorage from '@react-native-async-storage/async-storage';

// const httpLink = createHttpLink({
//   uri: 'https://api.safetycamai.com/graphql/',
// });

// const authLink = setContext(async (_, { headers }) => {
//   const token = await AsyncStorage.getItem('accessToken');
//   return {
//     headers: {
//       ...headers,
//       authorization: token ? `Bearer ${token}` : '',
//     },
//   };
// });

// const wsLink = new WebSocketLink({
//   uri: 'wss://api.safetycamai.com/graphql/',
//   options: {
//     reconnect: true,
//     connectionParams: async () => {
//       const token = await AsyncStorage.getItem('accessToken');
//       return {
//         authorization: token ? `Bearer ${token}` : '',
//       };
//     },
//   },
// });

// const splitLink = split(
//   ({ query }) => {
//     const def = getMainDefinition(query);
//     return def.kind === 'OperationDefinition' && def.operation === 'subscription';
//   },
//   wsLink,
//   authLink.concat(httpLink)
// );

// export const client = new ApolloClient({
//   link: splitLink,
//   cache: new InMemoryCache(),
// });










// import { ApolloClient, InMemoryCache, split, createHttpLink } from '@apollo/client';
// import { WebSocketLink } from '@apollo/client/link/ws';
// import { getMainDefinition } from '@apollo/client/utilities';

// const httpLink = createHttpLink({
//   uri: 'https://api.safetycamai.com/graphql/',
//   fetch: (uri, options) => {
//     if (options.body instanceof FormData) {
//       return fetch(uri, {
//         ...options,
//         headers: { ...(options.headers || {}) },
//         body: options.body,
//       });
//     }
//     return fetch(uri, options);
//   },
// });

// const wsLink = new WebSocketLink({
//   uri: 'wss://api.safetycamai.com/graphql/',
//   options: {
//     reconnect: true,
//   },
// });

// const splitLink = split(
//   ({ query }) => {
//     const def = getMainDefinition(query);
//     return def.kind === 'OperationDefinition' && def.operation === 'subscription';
//   },
//   wsLink,
//   httpLink
// );

// export const client = new ApolloClient({
//   link: splitLink,
//   cache: new InMemoryCache(),
// });
