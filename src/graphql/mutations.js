// src/graphql/mutations.js
import { gql } from '@apollo/client';

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

// 👉 MFA validateOtp (same shape as web)
export const VALIDATE_OTP = gql`
  mutation validateOtp($otp: String!) {
    validateOtp(otp: $otp) {
      token {
        token
        refreshToken
      }
      isEmailVerified
    }
  }
`;



// import { gql } from '@apollo/client';

// // export const LOGIN_MUTATION = gql`
// //   mutation ($email: String!, $password: String!) {
// //     login(input: { email: $email, password: $password }) {
// //       token {
// //         token
// //         refreshToken
// //       }
// //       isEmailVerified
// //     }
// //   }
// // `;
// export const LOGIN_MUTATION = gql`
//   mutation ($email: String!, $password: String!) {
//     login(input: { email: $email, password: $password }) {
//       token { token refreshToken }
//       isEmailVerified
//     }
//   }
// `;
// export const REGISTER_MUTATION = gql`
//   mutation ($email: String!, $password: String!, $name: String!, $type: String!) {
//     register(
//       input: { name: $name, email: $email, password: $password }
//       type: $type
//     )
//   }
// `;


// export const FORGOT_PASSWORD = gql`
//   mutation ForgetPassword($email: String!, $type: String!) {
//     forgetPassword(email: $email, type: $type)
//   }
// `;


// export const RESET_PASSWORD = gql`
//   mutation ($email: String!, $code: String!, $password: String!) {
//     resetPasswordd(input: { code: $code, email: $email, password: $password })
//   }
// `;

// export const VERIFY_EMAIL_ADDRESS_MUTATION = gql`
//   mutation ($code: String!, $email: String!) {
//     verifyEmailAddress(input: { code: $code, email: $email })
//   }
// `;

// export const VERIFY_TOKEN = gql`
//   mutation ($provider: String!, $code: UUID!, $email: String!) {
//     verifyToken(input: { code: $code, provider: $provider, email: $email })
//   }
// `;


// export const REFRESH_TOKEN = gql`
//   mutation ($token: String!, $refreshToken: String!) {
//     refreshToken(refreshToken: $refreshToken, token: $token) {
//       token
//       refreshToken
//     }
//   }
// `;
// // export const GET_API_KEY = gql`
// //   query {
// //     apiKeys {
// //       items {
// //         secret
// //       }
// //     }
// //   }
// // `;

// export const GET_ME = gql`
//   query GetMe {
//     me {
//       id
//       email
//       name
//     }
//   }
// `;

// export const GET_USER_API_KEY = gql`
//   query GetUserApiKey($userId: String!) {
//     apiKeys(where: { userId: { eq: $userId }, isDeleted: { eq: false } }) {
//       items {
//         secret
//       }
//     }
//   }
// `;


// export const GET_PENDING_LOOKUPS = gql`
//   query ($userId: String) {
//     pendingLookups(userId: $userId) {
//       pendingLookups
//       lastDate
//     }
//   }
// `;

// export const VALIDATE_OTP = gql`
//   mutation ValidateOtp($otp: String!) {
//     validateOtp(otp: $otp) {
//       token { token refreshToken }
//       isEmailVerified
//     }
//   }
// `;