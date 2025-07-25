import { useTranslations } from 'next-intl'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogCancel,
  AlertDialogDescription,
} from 'components/ui/alert-dialog'
import {
  useGetApiV1OrgGroupsQuery,
  usePostApiV1UsersByAuthIdOrgGroupsAndOrgGroupIdMutation,
  useDeleteApiV1UsersByAuthIdOrgGroupsAndOrgGroupIdMutation,
  useGetApiV1UsersByAuthIdQuery,
} from 'services/auth/api'
import SubmitError from 'components/SubmitError'

import { Checkbox } from 'components/ui/checkbox'
import { Label } from 'components/ui/label'

const UserOrgGroupModal = ({
  orgId,
  authId,
  show,
  onClose,
}: {
  orgId: number;
  authId: string;
  show: boolean;
  onClose: () => void;
}) => {
  const t = useTranslations()

  const { data: orgGroupsData } = useGetApiV1OrgGroupsQuery({ orgId })
  const orgGroups = orgGroupsData?.orgGroups ?? []

  const {
    data: userData, refetch: refetchUser,
  } = useGetApiV1UsersByAuthIdQuery({ authId: String(authId) })
  const user = userData?.user
  const userOrgGroupIds = user?.orgGroups?.map((orgGroup) => orgGroup.id) ?? []

  const [postUserOrgGroup, { isLoading: isPostingUserOrgGroup }] =
    usePostApiV1UsersByAuthIdOrgGroupsAndOrgGroupIdMutation()
  const [deleteUserOrgGroup, { isLoading: isDeletingUserOrgGroup }] =
    useDeleteApiV1UsersByAuthIdOrgGroupsAndOrgGroupIdMutation()

  const isLoading = isPostingUserOrgGroup || isDeletingUserOrgGroup

  const handleToggleOrgGroup = (orgGroupId: number) => {
    const assigned = userOrgGroupIds.includes(orgGroupId)
    if (assigned) {
      deleteUserOrgGroup({
        authId, orgGroupId,
      })
        .then(() => {
          refetchUser()
        })
    } else {
      postUserOrgGroup({
        authId, orgGroupId,
      })
        .then(() => {
          refetchUser()
        })
    }
  }

  return (
    <AlertDialog open={show}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('users.manageUserOrgGroup')}</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription>{t('users.selectOrgGroups')}</AlertDialogDescription>
        <section className='flex max-md:flex-col gap-6 max-md:gap-2 flex-wrap'>
          {orgGroups.map((orgGroup) => (
            <div
              key={orgGroup.id}
              className='flex items-center gap-2'>
              <Checkbox
                data-testid='scopeInput'
                id={`orgGroup-${orgGroup.id}`}
                onClick={() => handleToggleOrgGroup(orgGroup.id)}
                checked={userOrgGroupIds.includes(orgGroup.id)}
                disabled={isLoading}
              />
              <Label
                htmlFor={`orgGroup-${orgGroup.id}`}
                className='flex'
              >
                {orgGroup.name}
              </Label>
            </div>
          ))}
        </section>
        <SubmitError />
        <AlertDialogFooter className='flex gap-2'>
          <AlertDialogCancel onClick={onClose}>
            {t('common.close')}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default UserOrgGroupModal
