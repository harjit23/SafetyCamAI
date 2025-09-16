import { gql } from '@apollo/client';

// export const LOGIN_MUTATION = gql`
//   mutation ($email: String!, $password: String!) {
//     login(input: { email: $email, password: $password }) {
//       token {
//         token
//         refreshToken
//       }
//       isEmailVerified
//     }
//   }
// `;
export const LOGIN_MUTATION = gql`
  mutation ($email: String!, $password: String!) {
    login(input: { email: $email, password: $password }) {
      token {
        token
        refreshToken
      }
      isEmailVerified
    }
  }
`;
export const REGISTER_MUTATION = gql`
  mutation ($email: String!, $password: String!, $name: String!, $type: String!) {
    register(
      input: { name: $name, email: $email, password: $password }
      type: $type
    )
  }
`;


export const FORGOT_PASSWORD = gql`
  mutation ForgetPassword($email: String!, $type: String!) {
    forgetPassword(email: $email, type: $type)
  }
`;


export const RESET_PASSWORD = gql`
  mutation ($email: String!, $code: String!, $password: String!) {
    resetPasswordd(input: { code: $code, email: $email, password: $password })
  }
`;

export const VERIFY_EMAIL_ADDRESS_MUTATION = gql`
  mutation ($code: String!, $email: String!) {
    verifyEmailAddress(input: { code: $code, email: $email })
  }
`;

export const VERIFY_TOKEN = gql`
  mutation ($provider: String!, $code: UUID!, $email: String!) {
    verifyToken(input: { code: $code, provider: $provider, email: $email })
  }
`;


export const REFRESH_TOKEN = gql`
  mutation ($token: String!, $refreshToken: String!) {
    refreshToken(refreshToken: $refreshToken, token: $token) {
      token
      refreshToken
    }
  }
`;
// export const GET_API_KEY = gql`
//   query {
//     apiKeys {
//       items {
//         secret
//       }
//     }
//   }
// `;

export const GET_ME = gql`
  query GetMe {
    me {
      id
      email
      name
    }
  }
`;

export const GET_USER_API_KEY = gql`
  query GetUserApiKey($userId: String!) {
    apiKeys(where: { userId: { eq: $userId }, isDeleted: { eq: false } }) {
      items {
        secret
      }
    }
  }
`;


export const GET_PENDING_LOOKUPS = gql`
  query ($userId: String) {
    pendingLookups(userId: $userId) {
      pendingLookups
      lastDate
    }
  }
`;
// import axios from 'axios';
// import { client } from '../apollo/client';
// import { STATUS_SUBSCRIPTION } from './subscriptions';

// export const uploadAndTrack = async ({
//   picked,
//   onProgress,
//   onComplete,
//   onError,
// }) => {
//   const subscriptionId = `${Date.now()}`;
//   console.log('[uploadAndTrack] Picked image:', picked);

//   const formData = new FormData();
//   const operations = {
//     query: `
//       mutation uploadService($apiKey: String, $file: Upload!, $subscriptionId: String!) {
//         uploadService(apiKey: $apiKey, file: $file, subscriptionId: $subscriptionId) {
//           name
//           url
//           confidence
//           imageUrl
//         }
//       }
//     `,
//     variables: {
//       apiKey: null,
//       file: null,
//       subscriptionId: subscriptionId,
//     },
//   };

//   formData.append('operations', JSON.stringify(operations));
//   formData.append('map', JSON.stringify({ '0': ['variables.file'] }));
//   formData.append('0', {
//     uri: picked.uri,
//     type: picked.type,
//     name: picked.fileName,
//   });

//   console.log('[uploadAndTrack] Uploading image with subscriptionId:', subscriptionId);

//   try {
//     const uploadResponse = await axios.post(
//       'https://api.safetycamai.com/graphql/',
//       formData,
//       {
//         headers: {
//           'graphql-preflight': 'true',
//           'Content-Type': 'multipart/form-data',
//         },
//       }
//     );

//     console.log('[uploadAndTrack] Mutation response:', uploadResponse.data);

//     if (uploadResponse.data.errors) {
//       console.error('[uploadAndTrack] GraphQL Error:', uploadResponse.data.errors);
//       onError(uploadResponse.data.errors[0].message);
//       return;
//     }

//     const results = uploadResponse.data.data?.uploadService || [];

//     const observable = client.subscribe({
//       query: STATUS_SUBSCRIPTION,
//       variables: { id: subscriptionId },
//     });

//     const subscription = observable.subscribe({
//       next({ data }) {
//         const message = data?.onMessage;
//         console.log('[uploadAndTrack] Subscription message:', message);

//         if (message?.body === 'Detection Completed.') {
//           onComplete(results);
//           subscription.unsubscribe();
//         } else {
//           onProgress(message);
//         }
//       },
//       error(err) {
//         console.error('[uploadAndTrack] Subscription error:', err.message);
//         onError(err.message);
//       },
//     });

//   } catch (err) {
//     console.error('[uploadAndTrack] Upload axios error:', err.message);
//     onError(err.message);
//   }
// };
