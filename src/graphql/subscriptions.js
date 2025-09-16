import { gql } from '@apollo/client';

export const STATUS_SUBSCRIPTION = gql`
  subscription onMessage($id: String!) {
    onMessage(id: $id) {
      body
      timestamp
      index
    }
  }
`;
