import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Tables, Json } from '@/lib/types'

export interface SavedDocRef {
  name: string
  url: string
  type: string
}

export type OrderConfirmationRow = Tables<'order_confirmations'> & {
  uploader: Pick<Tables<'users'>, 'id' | 'full_name' | 'email'> | null
  reviewer: Pick<Tables<'users'>, 'id' | 'full_name' | 'email'> | null
}

const CONFIRMATION_SELECT = `
  *,
  uploader:users!order_confirmations_uploaded_by_fkey(id, full_name, email),
  reviewer:users!order_confirmations_reviewed_by_fkey(id, full_name, email)
`

export function useOrderConfirmation(scheduleId: string | null) {
  const { user } = useAuth()
  const [confirmation, setConfirmation] = useState<OrderConfirmationRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  const fetchLatest = useCallback(async () => {
    if (!scheduleId) {
      setConfirmation(null)
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('order_confirmations')
      .select(CONFIRMATION_SELECT)
      .eq('schedule_id', scheduleId)
      .order('created_at', { ascending: false })
      .limit(1)

    setConfirmation(
      data && data.length > 0 ? (data[0] as unknown as OrderConfirmationRow) : null
    )
    setLoading(false)
  }, [scheduleId])

  useEffect(() => {
    fetchLatest()

    if (!scheduleId) return

    const channel = supabase
      .channel(`order-conf:${scheduleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_confirmations',
          filter: `schedule_id=eq.${scheduleId}`,
        },
        () => fetchLatest()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [scheduleId, fetchLatest])

  /** Upload a single file (legacy, backward compat). Creates a new row. */
  async function uploadFile(file: File) {
    if (!scheduleId || !user) throw new Error('Missing context')
    setUploading(true)
    try {
      const path = `confirmations/${scheduleId}/${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('order-confirmations')
        .upload(path, file)
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('order-confirmations')
        .getPublicUrl(path)

      const { error: insertError } = await supabase
        .from('order_confirmations')
        .insert({
          schedule_id: scheduleId,
          file_url: urlData.publicUrl,
          file_name: file.name,
          uploaded_by: user.id,
          status: 'pending_approval',
        })
      if (insertError) throw insertError
    } finally {
      setUploading(false)
    }
  }

  /** Upload multiple files at once. Creates a new row with files JSONB. */
  async function uploadFiles(files: File[]) {
    if (!scheduleId || !user) throw new Error('Missing context')
    setUploading(true)
    try {
      const uploadedDocs: SavedDocRef[] = []

      for (const file of files) {
        const path = `confirmations/${scheduleId}/${Date.now()}-${file.name}`
        const { error: uploadError } = await supabase.storage
          .from('order-confirmations')
          .upload(path, file)
        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('order-confirmations')
          .getPublicUrl(path)

        const fileType = file.type.startsWith('image/')
          ? 'image'
          : file.type === 'application/pdf'
            ? 'pdf'
            : 'excel'

        uploadedDocs.push({
          name: file.name,
          url: urlData.publicUrl,
          type: fileType,
        })
      }

      // Use first file for backward compat fields
      const firstDoc = uploadedDocs[0]

      const { error: insertError } = await supabase
        .from('order_confirmations')
        .insert({
          schedule_id: scheduleId,
          file_url: firstDoc?.url ?? '',
          file_name: firstDoc?.name ?? '',
          files: uploadedDocs as unknown as Json,
          uploaded_by: user.id,
          status: 'pending_approval',
        })
      if (insertError) throw insertError
    } finally {
      setUploading(false)
    }
  }

  /**
   * Save pending files and merge with existing saved docs.
   * Updates the confirmation row's files JSONB.
   */
  async function saveFiles(
    pendingFiles: File[],
    existingSavedDocs: SavedDocRef[]
  ) {
    if (!scheduleId || !user) throw new Error('Missing context')
    setUploading(true)
    try {
      const newDocs: SavedDocRef[] = []

      for (const file of pendingFiles) {
        const path = `confirmations/${scheduleId}/${Date.now()}-${file.name}`
        const { error: uploadError } = await supabase.storage
          .from('order-confirmations')
          .upload(path, file)
        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('order-confirmations')
          .getPublicUrl(path)

        const fileType = file.type.startsWith('image/')
          ? 'image'
          : file.type === 'application/pdf'
            ? 'pdf'
            : 'excel'

        newDocs.push({
          name: file.name,
          url: urlData.publicUrl,
          type: fileType,
        })
      }

      const allDocs = [...existingSavedDocs, ...newDocs]
      const firstDoc = allDocs[0]

      if (confirmation) {
        // Update existing row
        const { error } = await supabase
          .from('order_confirmations')
          .update({
            file_url: firstDoc?.url ?? confirmation.file_url,
            file_name: firstDoc?.name ?? confirmation.file_name,
            files: allDocs as unknown as Json,
          })
          .eq('id', confirmation.id)
        if (error) throw error
      } else {
        // Create new row
        const { error } = await supabase
          .from('order_confirmations')
          .insert({
            schedule_id: scheduleId,
            file_url: firstDoc?.url ?? '',
            file_name: firstDoc?.name ?? '',
            files: allDocs as unknown as Json,
            uploaded_by: user.id,
            status: 'pending_approval',
          })
        if (error) throw error
      }

      return allDocs
    } finally {
      setUploading(false)
    }
  }

  /** Approve the current confirmation (supervisor role) */
  async function approve() {
    if (!confirmation || !user) throw new Error('Missing context')
    const { error } = await supabase
      .from('order_confirmations')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', confirmation.id)
    if (error) throw error
  }

  /** Reject the current confirmation with a reason (supervisor role) */
  async function reject(reason: string) {
    if (!confirmation || !user) throw new Error('Missing context')
    const { error } = await supabase
      .from('order_confirmations')
      .update({
        status: 'rejected',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      .eq('id', confirmation.id)
    if (error) throw error
  }

  return {
    confirmation,
    loading,
    uploading,
    uploadFile,
    uploadFiles,
    saveFiles,
    approve,
    reject,
    refetch: fetchLatest,
  }
}
