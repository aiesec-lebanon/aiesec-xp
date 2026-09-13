/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import { GraphQLClient, type RequestOptions } from 'graphql-request';
import gql from 'graphql-tag';
type GraphQLClientRequestHeaders = RequestOptions['requestHeaders'];
export type ApplicationFilter = {
  backgrounds?: Array<number | null | undefined> | null | undefined;
  branch?: number | null | undefined;
  campaign_ids?: Array<number | null | undefined> | null | undefined;
  created_at?: DateInput | null | undefined;
  custom_status_exist?: boolean | null | undefined;
  /** Removed. Use custom_status_ids instead */
  custom_status_id?: number | null | undefined;
  custom_status_ids?: Array<number | null | undefined> | null | undefined;
  date_an_signed?: DateInput | null | undefined;
  date_approval_broken?: DateInput | null | undefined;
  date_approved?: DateInput | null | undefined;
  date_matched?: DateInput | null | undefined;
  date_realisation_broke?: DateInput | null | undefined;
  date_realized?: DateInput | null | undefined;
  date_remote_realized?: DateInput | null | undefined;
  /** Available types - short, medium, long */
  duration_type?: Array<string | null | undefined> | null | undefined;
  earliest_start_date?: DateInput | null | undefined;
  experience_end_date?: DateInput | null | undefined;
  experience_start_date?: DateInput | null | undefined;
  experience_type?: Array<ExperienceType> | null | undefined;
  favourite?: boolean | null | undefined;
  for?: string | null | undefined;
  full_name?: string | null | undefined;
  graduation_date?: DateInput | null | undefined;
  has_managers?: boolean | null | undefined;
  has_profile_photo?: boolean | null | undefined;
  has_started_standards_survey?: boolean | null | undefined;
  has_stories?: boolean | null | undefined;
  is_aiesecer?: boolean | null | undefined;
  is_ge?: boolean | null | undefined;
  is_interviewed?: boolean | null | undefined;
  languages?: Array<number | null | undefined> | null | undefined;
  last_interaction?: DateInput | null | undefined;
  my?: string | null | undefined;
  nationalities?: Array<number | null | undefined> | null | undefined;
  nps_grade_value?: RangeInput | null | undefined;
  opportunities?: Array<number | null | undefined> | null | undefined;
  opportunity_committee?: number | null | undefined;
  opportunity_home_lc?: Array<number | null | undefined> | null | undefined;
  opportunity_home_mc?: Array<number | null | undefined> | null | undefined;
  opportunity_home_region?: Array<number | null | undefined> | null | undefined;
  opportunity_id?: number | null | undefined;
  organisation?: number | null | undefined;
  partner_type?: Array<PartnerTypes> | null | undefined;
  person_committee?: number | null | undefined;
  person_home_lc?: Array<number | null | undefined> | null | undefined;
  person_home_mc?: Array<number | null | undefined> | null | undefined;
  person_home_region?: Array<number | null | undefined> | null | undefined;
  person_id?: number | null | undefined;
  programmes?: Array<number | null | undefined> | null | undefined;
  q?: string | null | undefined;
  rejection_reasons?: Array<number | null | undefined> | null | undefined;
  remote_opportunity?: boolean | null | undefined;
  remote_start_date?: DateInput | null | undefined;
  scheduled_interview?: DateInput | null | undefined;
  sdg_goals?: Array<number | null | undefined> | null | undefined;
  sdg_targets?: Array<number | null | undefined> | null | undefined;
  skills?: Array<number | null | undefined> | null | undefined;
  slots?: Array<number | null | undefined> | null | undefined;
  sort?: ApplicationSortOption | null | undefined;
  sort_direction?: BaseSortDirection | null | undefined;
  standards?: Array<number | null | undefined> | null | undefined;
  status?: string | null | undefined;
  statuses?: Array<string | null | undefined> | null | undefined;
  study_levels?: Array<number | null | undefined> | null | undefined;
  sub_products?: Array<number | null | undefined> | null | undefined;
  tags?: Array<number | null | undefined> | null | undefined;
  testimonial_filled_at?: DateInput | null | undefined;
  work_types?: Array<number | null | undefined> | null | undefined;
};

export type ApplicationSortOption =
  | 'applicant_name'
  | 'average_score'
  | 'created_at'
  | 'date_an_signed'
  | 'date_approved'
  | 'date_matched'
  | 'date_realized'
  | 'duration_type'
  | 'experience_end_date'
  | 'experience_start_date'
  | 'favourite'
  | 'flight_date'
  | 'graduation_date'
  | 'has_started_standards_survey'
  | 'home_lc_name'
  | 'home_mc_name'
  | 'host_lc_name'
  | 'host_mc_name'
  | 'is_gep'
  | 'last_active'
  | 'nps_grade'
  | 'opportunity_id'
  | 'opportunity_title'
  | 'organisation_name'
  | 'paid_at'
  | 'partner_type'
  | 'product'
  | 'required_backgrounds_percentage'
  | 'required_skills_percentage'
  | 'scheduled_interview'
  | 'sdg_goal'
  | 'sdg_target'
  | 'slot'
  | 'status'
  | 'sub_product'
  | 'updated_at';

export type BaseSortDirection =
  | 'asc'
  | 'desc';

export type DateInput = {
  end_date?: string | null | undefined;
  from?: string | null | undefined;
  start_date?: string | null | undefined;
  to?: string | null | undefined;
};

export type ExperienceType =
  | 'partly_remote'
  | 'physical'
  | 'remote';

export type PartnerTypes =
  | 'global'
  | 'regional';

export type RangeInput = {
  from?: number | null | undefined;
  max?: number | null | undefined;
  min?: number | null | undefined;
  to?: number | null | undefined;
};

export type CurrentPersonQueryVariables = Exact<{ [key: string]: never; }>;


export type CurrentPersonQuery = { currentPerson: { id: string, full_name: string | null, profile_photo: string | null, current_office: { id: string, name: string | null } | null, current_positions: Array<{ id: number | null, title: string | null, status: string | null, start_date: string | null, end_date: string | null, office: { id: string, name: string | null, tag: string | null } | null, role: { id: string | null, name: string | null } | null } | null> | null } | null };

export type OfficeChildrenQueryVariables = Exact<{
  parentIds?: Array<number | null | undefined> | number | null | undefined;
}>;


export type OfficeChildrenQuery = { committees: { data: Array<{ id: string, name: string | null, tag: string | null, parent: { id: string } | null } | null> | null, paging: { total_items: number | null, total_pages: number | null } | null } | null };

export type MemberPositionsQueryVariables = Exact<{
  officeId?: number | null | undefined;
  personIds?: Array<string | number> | string | number | null | undefined;
  status?: Array<string | null | undefined> | string | null | undefined;
  page: number;
  perPage: number;
}>;


export type MemberPositionsQuery = { memberPositions: { data: Array<{ id: number | null, title: string | null, status: string | null, start_date: string | null, end_date: string | null, office: { id: string, name: string | null } | null, role: { id: string | null, name: string | null } | null, person: { id: string, full_name: string | null, profile_photo: string | null } | null } | null> | null, paging: { total_items: number | null, total_pages: number | null, current_page: number | null } | null } | null };

export type ApplicationsQueryVariables = Exact<{
  filters?: ApplicationFilter | null | undefined;
  page: number;
  perPage: number;
}>;


export type ApplicationsQuery = { allOpportunityApplication: { data: Array<{ id: string | null, status: string | null, created_at: string | null, person: { id: string } | null, opportunity: { id: string, programme: { id: string | null } | null } | null, meta: { date_approved: string | null, date_approval_broken: string | null, date_realized: string | null, date_realisation_broke: string | null, remote_realized_at: string | null, date_rejected: string | null, date_withdrawn: string | null } | null } | null> | null, paging: { total_items: number | null, total_pages: number | null, current_page: number | null } | null } | null };

export type ApplicationManagersQueryVariables = Exact<{
  filters?: ApplicationFilter | null | undefined;
  page: number;
  perPage: number;
}>;


export type ApplicationManagersQuery = { allOpportunityApplication: { data: Array<{ id: string | null, person: { id: string } | null, managers: Array<{ id: string, full_name: string | null } | null> | null } | null> | null, paging: { total_pages: number | null } | null } | null };


export const CurrentPersonDocument = gql`
    query CurrentPerson {
  currentPerson {
    id
    full_name
    profile_photo
    current_office {
      id
      name
    }
    current_positions {
      id
      title
      status
      start_date
      end_date
      office {
        id
        name
        tag
      }
      role {
        id
        name
      }
    }
  }
}
    `;
export const OfficeChildrenDocument = gql`
    query OfficeChildren($parentIds: [Int]) {
  committees(filters: {parent: $parentIds}, per_page: 100) {
    data {
      id
      name
      tag
      parent {
        id
      }
    }
    paging {
      total_items
      total_pages
    }
  }
}
    `;
export const MemberPositionsDocument = gql`
    query MemberPositions($officeId: Int, $personIds: [ID!], $status: [String], $page: Int!, $perPage: Int!) {
  memberPositions(
    filters: {office_id: $officeId, person_ids: $personIds, status: $status}
    page: $page
    per_page: $perPage
  ) {
    data {
      id
      title
      status
      start_date
      end_date
      office {
        id
        name
      }
      role {
        id
        name
      }
      person {
        id
        full_name
        profile_photo
      }
    }
    paging {
      total_items
      total_pages
      current_page
    }
  }
}
    `;
export const ApplicationsDocument = gql`
    query Applications($filters: ApplicationFilter, $page: Int!, $perPage: Int!) {
  allOpportunityApplication(filters: $filters, page: $page, per_page: $perPage) {
    data {
      id
      status
      created_at
      person {
        id
      }
      opportunity {
        id
        programme {
          id
        }
      }
      meta {
        date_approved
        date_approval_broken
        date_realized
        date_realisation_broke
        remote_realized_at
        date_rejected
        date_withdrawn
      }
    }
    paging {
      total_items
      total_pages
      current_page
    }
  }
}
    `;
export const ApplicationManagersDocument = gql`
    query ApplicationManagers($filters: ApplicationFilter, $page: Int!, $perPage: Int!) {
  allOpportunityApplication(filters: $filters, page: $page, per_page: $perPage) {
    data {
      id
      person {
        id
      }
      managers {
        id
        full_name
      }
    }
    paging {
      total_pages
    }
  }
}
    `;

export type SdkFunctionWrapper = <T>(action: (requestHeaders?:Record<string, string>) => Promise<T>, operationName: string, operationType?: string, variables?: any) => Promise<T>;


const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) => action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    CurrentPerson(variables?: CurrentPersonQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<CurrentPersonQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<CurrentPersonQuery>({ document: CurrentPersonDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'CurrentPerson', 'query', variables);
    },
    OfficeChildren(variables?: OfficeChildrenQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<OfficeChildrenQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<OfficeChildrenQuery>({ document: OfficeChildrenDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'OfficeChildren', 'query', variables);
    },
    MemberPositions(variables: MemberPositionsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<MemberPositionsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<MemberPositionsQuery>({ document: MemberPositionsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'MemberPositions', 'query', variables);
    },
    Applications(variables: ApplicationsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<ApplicationsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<ApplicationsQuery>({ document: ApplicationsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'Applications', 'query', variables);
    },
    ApplicationManagers(variables: ApplicationManagersQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<ApplicationManagersQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<ApplicationManagersQuery>({ document: ApplicationManagersDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'ApplicationManagers', 'query', variables);
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;