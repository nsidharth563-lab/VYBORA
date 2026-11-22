import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { AtSign, Camera, Link2, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LIMITS, updateProfileSchema } from '@vybora/shared';
import { ApiRequestError } from '@/lib/api';
import { errorMessage, zodFieldErrors } from '@/lib/form';
import { socialApi, type ProfilePatch } from '@/lib/social-api';
import { pickImage, uploadImage, type ImagePurpose } from '@/lib/upload';
import { useAuth } from '@/stores/auth';
import { useAppTheme } from '@/theme';
import { Avatar, Button, Icon, SwitchRow, Text, TextField, useToast } from '@/ui';

export default function EditProfile() {
  const { spacing, colors, radii, gradients } = useAppTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const user = useAuth((s) => s.user)!;
  const setUser = useAuth((s) => s.setUser);

  const [displayName, setDisplayName] = useState(user.displayName);
  const [username, setUsername] = useState(user.username);
  const [bio, setBio] = useState(user.bio ?? '');
  const [website, setWebsite] = useState(user.website ?? '');
  const [isPrivate, setPrivate] = useState(user.isPrivate);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<ImagePurpose | null>(null);
  const [preview, setPreview] = useState<{ avatar?: string; cover?: string }>({});

  /** Pick → upload → attach immediately (photo changes save on their own). */
  const changeImage = async (purpose: ImagePurpose) => {
    try {
      const asset = await pickImage(purpose);
      if (!asset) return;
      setPreview((p) => ({ ...p, [purpose]: asset.uri }));
      setUploading(purpose);
      const media = await uploadImage(purpose, asset);
      const me = await socialApi.updateProfile(purpose === 'avatar' ? { avatarMediaId: media.id } : { coverMediaId: media.id });
      setUser(me);
      void qc.invalidateQueries({ queryKey: ['me'] });
      toast.show({ message: purpose === 'avatar' ? 'Profile photo updated' : 'Cover updated', tone: 'success' });
    } catch (e) {
      setPreview((p) => ({ ...p, [purpose]: undefined }));
      toast.show({ message: e instanceof Error && !(e instanceof ApiRequestError) ? e.message : errorMessage(e), tone: 'error' });
    } finally {
      setUploading(null);
    }
  };

  const removeImage = async (purpose: ImagePurpose) => {
    try {
      setUser(await socialApi.updateProfile(purpose === 'avatar' ? { avatarMediaId: null } : { coverMediaId: null }));
      setPreview((p) => ({ ...p, [purpose]: undefined }));
    } catch (e) {
      toast.show({ message: errorMessage(e), tone: 'error' });
    }
  };

  const save = async () => {
    const patch: ProfilePatch = {};
    if (displayName !== user.displayName) patch.displayName = displayName;
    if (username !== user.username) patch.username = username;
    if (bio !== (user.bio ?? '')) patch.bio = bio;
    if (website !== (user.website ?? '')) patch.website = website;
    if (isPrivate !== user.isPrivate) patch.isPrivate = isPrivate;
    if (!Object.keys(patch).length) return router.back();
    const { data, errors: local } = zodFieldErrors(updateProfileSchema, patch);
    setErrors(local);
    if (!data) return;
    setSaving(true);
    try {
      setUser(await socialApi.updateProfile(patch));
      void qc.invalidateQueries({ queryKey: ['me'] });
      toast.show({ message: 'Profile saved', tone: 'success' });
      router.back();
    } catch (e) {
      if (e instanceof ApiRequestError && Object.keys(e.fieldErrors).length) setErrors(e.fieldErrors);
      else toast.show({ message: errorMessage(e), tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const coverUri = preview.cover ?? user.coverUrl;
  const avatarUri = preview.avatar ?? user.avatarUrl;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing[4], gap: spacing[4], maxWidth: 560, width: '100%', alignSelf: 'center' }}>
        <View>
          <Pressable
            onPress={() => void changeImage('cover')}
            disabled={!!uploading}
            accessibilityRole="button"
            accessibilityLabel="Change cover photo"
            style={[styles.cover, { borderRadius: radii.lg, backgroundColor: colors.surfaceMuted }]}
            testID="change-cover"
          >
            {coverUri ? (
              <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <LinearGradient colors={gradients.signal} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { opacity: 0.85 }]} />
            )}
            <View style={[styles.badge, { backgroundColor: 'rgba(10,10,15,0.55)', borderRadius: radii.pill }]}>
              {uploading === 'cover' ? <ActivityIndicator color="#fff" /> : <Icon as={Camera} size="sm" color="#FFFFFF" />}
            </View>
          </Pressable>
          <Pressable
            onPress={() => void changeImage('avatar')}
            disabled={!!uploading}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            style={[styles.avatar, { backgroundColor: colors.background }]}
            testID="change-avatar"
          >
            <Avatar name={user.displayName} uri={avatarUri} blurhash={preview.avatar ? null : user.avatarBlurhash} size="xl" />
            <View style={[styles.avatarBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
              {uploading === 'avatar' ? <ActivityIndicator color={colors.primaryText} size="small" /> : <Icon as={Camera} size="xs" color={colors.primaryText} />}
            </View>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing[2] }}>
          {user.avatarUrl ? <Button label="Remove photo" size="sm" variant="ghost" onPress={() => void removeImage('avatar')} /> : null}
          {user.coverUrl ? <Button label="Remove cover" size="sm" variant="ghost" onPress={() => void removeImage('cover')} /> : null}
        </View>

        <TextField label="Name" leftIcon={UserRound} value={displayName} onChangeText={setDisplayName} maxLength={LIMITS.displayNameMax} error={errors.displayName} testID="edit-name" />
        <TextField label="Username" leftIcon={AtSign} value={username} onChangeText={(t) => setUsername(t.replace(/\s/g, ''))} autoCapitalize="none" autoCorrect={false} maxLength={30} error={errors.username} testID="edit-username" />
        <TextField label="Bio" value={bio} onChangeText={setBio} multiline maxLength={LIMITS.bioMax} showCount error={errors.bio} testID="edit-bio" />
        <TextField label="Website" leftIcon={Link2} value={website} onChangeText={setWebsite} autoCapitalize="none" keyboardType="url" placeholder="yourwebsite.com" error={errors.website} testID="edit-website" />
        <SwitchRow
          label="Private account"
          description="Only people you approve can see your posts, followers and following."
          value={isPrivate}
          onValueChange={setPrivate}
          testID="edit-private"
        />
        {user.isPrivate && !isPrivate ? (
          <Text variant="caption" tone="secondary">
            Going public approves all pending follow requests.
          </Text>
        ) : null}
        <Button label="Save" size="lg" fullWidth loading={saving} disabled={!!uploading} onPress={save} testID="edit-save" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  cover: { height: 120, overflow: 'hidden', alignItems: 'flex-end', justifyContent: 'flex-end', padding: 10 },
  badge: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  avatar: { alignSelf: 'flex-start', borderRadius: 999, padding: 4, marginTop: -44, marginLeft: 4 },
  avatarBadge: { position: 'absolute', right: 2, bottom: 2, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
});
