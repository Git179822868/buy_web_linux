"use client";

/* eslint-disable @next/next/no-img-element */

import { Globe, ImageUp, LockKeyhole, Plus, Save, ShieldCheck, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type AdminProfile = {
  avatarUrl: string | null;
  bio: string | null;
  name: string | null;
  phone: string | null;
  username: string;
};

type SiteSetting = {
  copyright: string | null;
  description: string | null;
  icoUrl: string | null;
  icpNo: string | null;
  keywords: string | null;
  logoUrl: string | null;
  operator: string | null;
  siteName: string;
};

type Contact = {
  id: string;
  isEnabled: boolean;
  label: string;
  qrUrl: string | null;
  sortOrder: number;
  type: string;
  value: string | null;
};

export function AdminProfileWorkspace({
  contacts,
  profile,
  setting,
}: {
  contacts: Contact[];
  profile: AdminProfile;
  setting: SiteSetting;
}) {
  const router = useRouter();
  const [profileForm, setProfileForm] = useState({
    avatarUrl: profile.avatarUrl || "",
    bio: profile.bio || "",
    name: profile.name || "",
    phone: profile.phone || "",
  });
  const [siteForm, setSiteForm] = useState({
    copyright: setting.copyright || "",
    description: setting.description || "",
    icoUrl: setting.icoUrl || "",
    icpNo: setting.icpNo || "",
    keywords: setting.keywords || "",
    logoUrl: setting.logoUrl || "",
    operator: setting.operator || "",
    siteName: setting.siteName || "",
  });
  const [contactRows, setContactRows] = useState(
    contacts.length
      ? contacts.map((item) => ({
          ...item,
          qrUrl: item.qrUrl || "",
          value: item.value || "",
        }))
      : [
          { id: "", isEnabled: false, label: "QQ", qrUrl: "", sortOrder: 10, type: "qq", value: "" },
          { id: "", isEnabled: false, label: "微信号", qrUrl: "", sortOrder: 20, type: "wechat", value: "" },
        ],
  );
  const [passwordForm, setPasswordForm] = useState({
    confirmPassword: "",
    currentPassword: "",
    newPassword: "",
  });
  const [profileMessage, setProfileMessage] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [isProfilePending, startProfileTransition] = useTransition();
  const [isSettingsPending, startSettingsTransition] = useTransition();
  const [isPasswordPending, startPasswordTransition] = useTransition();

  const displayName = profileForm.name.trim() || profile.username;
  const accountTitle = profileForm.phone.trim() || profile.username;
  const avatarPreviewUrl = profileForm.avatarUrl.trim();
  const avatarMark = displayName.slice(0, 1).toUpperCase() || "A";

  function patchProfile(key: keyof typeof profileForm, value: string) {
    setProfileForm((current) => ({ ...current, [key]: value }));
  }

  function patchSite(key: keyof typeof siteForm, value: string) {
    setSiteForm((current) => ({ ...current, [key]: value }));
  }

  function patchContact(index: number, key: keyof (typeof contactRows)[number], value: string | boolean | number) {
    setContactRows((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)),
    );
  }

  function patchPassword(key: keyof typeof passwordForm, value: string) {
    setPasswordForm((current) => ({ ...current, [key]: value }));
  }

  function addContactRow() {
    setContactRows((current) => [
      ...current,
      {
        id: "",
        isEnabled: true,
        label: "新联系方式",
        qrUrl: "",
        sortOrder: current.length ? current[current.length - 1].sortOrder + 10 : 10,
        type: "support",
        value: "",
      },
    ]);
  }

  function removeContactRow(index: number) {
    setContactRows((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function uploadQr(index: number, file?: File | null) {
    if (!file) {
      return;
    }

    setUploadingIndex(index);
    setSettingsMessage("");

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/admin/contact-qr", {
      body: formData,
      method: "POST",
    });
    const json = await response.json();

    if (!response.ok) {
      setSettingsMessage(json.message || "上传失败");
      setUploadingIndex(null);
      return;
    }

    patchContact(index, "qrUrl", json.url);
    setSettingsMessage("二维码上传成功，记得点击保存网站设置");
    setUploadingIndex(null);
  }

  function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileMessage("");
    startProfileTransition(async () => {
      const response = await fetch("/api/admin/profile", {
        body: JSON.stringify(profileForm),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      });
      const json = await response.json();

      if (!response.ok) {
        setProfileMessage(json.message || "保存失败");
        return;
      }

      setProfileMessage("账号资料已保存");
      router.refresh();
    });
  }

  function submitSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSettingsMessage("");
    startSettingsTransition(async () => {
      const response = await fetch("/api/admin/settings", {
        body: JSON.stringify({ ...siteForm, contacts: contactRows }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      });
      const json = await response.json();

      if (!response.ok) {
        setSettingsMessage(json.message || "保存失败");
        return;
      }

      setSettingsMessage("网站信息与联系方式已保存");
      router.refresh();
    });
  }

  function submitPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage("");
    startPasswordTransition(async () => {
      const response = await fetch("/api/admin/password", {
        body: JSON.stringify(passwordForm),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      });
      const json = await response.json();

      if (!response.ok) {
        setPasswordMessage(json.message || "修改失败");
        return;
      }

      setPasswordForm({
        confirmPassword: "",
        currentPassword: "",
        newPassword: "",
      });
      setPasswordMessage("管理员密码已更新");
    });
  }

  return (
    <div className="admin-profile-workspace">
      <aside className="panel admin-profile-sidebar">
        <div className="admin-profile-summary">
          <div className="admin-profile-avatar">
            {avatarPreviewUrl ? (
              <img alt="管理员头像" src={avatarPreviewUrl} />
            ) : (
              <span>{avatarMark}</span>
            )}
          </div>
          <strong>{accountTitle}</strong>
          <span>{displayName}</span>
          <p>账号资料、网站信息、联系方式和密码都集中在这里维护。</p>
        </div>

        <div className="admin-profile-sidebar-group">
          <small>基本设置</small>
          <nav className="admin-profile-anchor-nav">
            <a href="#account-info">账号信息</a>
            <a href="#security-note">安全验证</a>
            <a href="#website-info">网站信息</a>
            <a href="#contact-info">联系方式</a>
            <a href="#password-info">密码</a>
          </nav>
        </div>
      </aside>

      <div className="admin-profile-main">
        <section className="panel admin-profile-section" id="account-info">
          <div className="admin-profile-section-head">
            <div>
              <h2>账号信息</h2>
              <p>维护管理员头像、姓名、联系电话和个人简介，左侧品牌区会跟随姓名刷新。</p>
            </div>
          </div>

          <form className="admin-profile-form-grid" onSubmit={submitProfile}>
            <div className="field">
              <label>账号</label>
              <input disabled value={profile.username} />
            </div>
            <div className="field">
              <label htmlFor="admin-name">姓名</label>
              <input
                id="admin-name"
                onChange={(event) => patchProfile("name", event.target.value)}
                value={profileForm.name}
              />
            </div>
            <div className="field">
              <label htmlFor="admin-phone">联系电话</label>
              <input
                id="admin-phone"
                onChange={(event) => patchProfile("phone", event.target.value)}
                value={profileForm.phone}
              />
            </div>
            <div className="field">
              <label htmlFor="admin-avatar">头像地址</label>
              <input
                id="admin-avatar"
                onChange={(event) => patchProfile("avatarUrl", event.target.value)}
                placeholder="可粘贴图片 URL"
                value={profileForm.avatarUrl}
              />
            </div>
            <div className="field wide">
              <label htmlFor="admin-bio">个人简介</label>
              <textarea
                id="admin-bio"
                onChange={(event) => patchProfile("bio", event.target.value)}
                rows={4}
                value={profileForm.bio}
              />
            </div>
            {profileMessage ? (
              <p className={profileMessage.includes("失败") ? "error-text wide" : "success-text wide"}>{profileMessage}</p>
            ) : null}
            <button className="primary-button" disabled={isProfilePending} type="submit">
              <Save size={16} />
              保存账号信息
            </button>
          </form>
        </section>

        <section className="panel admin-profile-section" id="security-note">
          <div className="admin-profile-section-head">
            <div>
              <h2>安全验证</h2>
              <p>当前后台尚未接入谷歌验证，如需二次验证可以在这一块继续扩展。</p>
            </div>
          </div>
          <div className="admin-inline-note">
            <ShieldCheck size={18} />
            <div>
              <strong>暂未启用谷歌验证</strong>
              <p>目前仍以管理员账号密码登录为主，建议先确保密码复杂度并定期更新。</p>
            </div>
          </div>
        </section>

        <form className="admin-settings-stack" onSubmit={submitSettings}>
          <section className="panel admin-profile-section" id="website-info">
            <div className="admin-profile-section-head">
              <div>
                <h2>网站信息</h2>
                <p>把原网站设置页合并到账号信息页，统一维护站点名称、SEO 和备案信息。</p>
              </div>
            </div>

            <div className="admin-profile-form-grid">
              <div className="field">
                <label htmlFor="siteName">站点名称</label>
                <input id="siteName" onChange={(event) => patchSite("siteName", event.target.value)} value={siteForm.siteName} />
              </div>
              <div className="field">
                <label htmlFor="operator">运营商</label>
                <input id="operator" onChange={(event) => patchSite("operator", event.target.value)} value={siteForm.operator} />
              </div>
              <div className="field">
                <label htmlFor="icpNo">ICP备案号</label>
                <input id="icpNo" onChange={(event) => patchSite("icpNo", event.target.value)} value={siteForm.icpNo} />
              </div>
              <div className="field">
                <label htmlFor="copyright">版权所有</label>
                <input
                  id="copyright"
                  onChange={(event) => patchSite("copyright", event.target.value)}
                  value={siteForm.copyright}
                />
              </div>
              <div className="field wide">
                <label htmlFor="keywords">关键词</label>
                <input
                  id="keywords"
                  onChange={(event) => patchSite("keywords", event.target.value)}
                  value={siteForm.keywords}
                />
              </div>
              <div className="field wide">
                <label htmlFor="description">网站描述</label>
                <textarea
                  id="description"
                  onChange={(event) => patchSite("description", event.target.value)}
                  rows={3}
                  value={siteForm.description}
                />
              </div>
              <div className="field">
                <label htmlFor="logoUrl">Logo 地址</label>
                <input id="logoUrl" onChange={(event) => patchSite("logoUrl", event.target.value)} value={siteForm.logoUrl} />
              </div>
              <div className="field">
                <label htmlFor="icoUrl">ICO 地址</label>
                <input id="icoUrl" onChange={(event) => patchSite("icoUrl", event.target.value)} value={siteForm.icoUrl} />
              </div>
            </div>
          </section>

          <section className="panel admin-profile-section" id="contact-info">
            <div className="admin-profile-section-head">
              <div>
                <h2>联系方式</h2>
                <p>维护 QQ、微信和其它客服入口，支持上传二维码并控制前台展示状态。</p>
              </div>
              <button className="secondary-button" onClick={addContactRow} type="button">
                <Plus size={16} />
                新增联系方式
              </button>
            </div>

            <div className="admin-contact-stack">
              {contactRows.map((contact, index) => (
                <article className="admin-contact-card" key={`${contact.id || "new"}-${index}`}>
                  <div className="admin-contact-card-head">
                    <strong>{contact.label || `联系方式 ${index + 1}`}</strong>
                    <button className="danger-button" onClick={() => removeContactRow(index)} type="button">
                      <Trash2 size={15} />
                      删除
                    </button>
                  </div>

                  <div className="admin-contact-card-body">
                    <div className="admin-contact-qr-pane">
                      <span>二维码</span>
                      <div className="admin-contact-qr-box">
                        {contact.qrUrl ? <img alt={`${contact.label} 二维码`} src={contact.qrUrl} /> : <ImageUp size={28} />}
                      </div>
                      <label className="secondary-button admin-upload-button">
                        <ImageUp size={15} />
                        {uploadingIndex === index ? "上传中" : "上传图片"}
                        <input
                          accept="image/png,image/jpeg,image/webp"
                          hidden
                          onChange={(event) => void uploadQr(index, event.target.files?.[0])}
                          type="file"
                        />
                      </label>
                    </div>

                    <div className="admin-contact-fields">
                      <div className="field">
                        <label>联系方式</label>
                        <select onChange={(event) => patchContact(index, "type", event.target.value)} value={contact.type}>
                          <option value="qq">QQ</option>
                          <option value="wechat">微信</option>
                          <option value="support">联系方式</option>
                          <option value="telegram">Telegram</option>
                        </select>
                      </div>
                      <div className="field">
                        <label>展示名称</label>
                        <input onChange={(event) => patchContact(index, "label", event.target.value)} value={contact.label} />
                      </div>
                      <div className="field wide">
                        <label>客服内容 / 账号</label>
                        <textarea
                          onChange={(event) => patchContact(index, "value", event.target.value)}
                          rows={3}
                          value={contact.value}
                        />
                      </div>
                      <div className="field wide">
                        <label>二维码地址</label>
                        <input onChange={(event) => patchContact(index, "qrUrl", event.target.value)} value={contact.qrUrl} />
                      </div>
                      <div className="field">
                        <label>排序</label>
                        <input
                          onChange={(event) => patchContact(index, "sortOrder", Number(event.target.value) || 0)}
                          type="number"
                          value={contact.sortOrder}
                        />
                      </div>
                      <div className="field">
                        <label>状态</label>
                        <select
                          onChange={(event) => patchContact(index, "isEnabled", event.target.value === "true")}
                          value={String(contact.isEnabled)}
                        >
                          <option value="true">开启</option>
                          <option value="false">关闭</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {settingsMessage ? (
              <p className={settingsMessage.includes("失败") ? "error-text" : "success-text"}>{settingsMessage}</p>
            ) : null}
            <div className="button-row">
              <button className="primary-button" disabled={isSettingsPending} type="submit">
                <Globe size={16} />
                保存网站设置
              </button>
            </div>
          </section>
        </form>

        <section className="panel admin-profile-section" id="password-info">
          <div className="admin-profile-section-head">
            <div>
              <h2>密码</h2>
              <p>管理员密码独立维护，修改后不会影响当前已登录的其它后台账号。</p>
            </div>
          </div>

          <form className="admin-profile-form-grid" onSubmit={submitPassword}>
            <div className="field wide">
              <label htmlFor="currentPassword">当前密码</label>
              <input
                id="currentPassword"
                onChange={(event) => patchPassword("currentPassword", event.target.value)}
                type="password"
                value={passwordForm.currentPassword}
              />
            </div>
            <div className="field">
              <label htmlFor="newPassword">新密码</label>
              <input
                id="newPassword"
                onChange={(event) => patchPassword("newPassword", event.target.value)}
                type="password"
                value={passwordForm.newPassword}
              />
            </div>
            <div className="field">
              <label htmlFor="confirmPassword">确认新密码</label>
              <input
                id="confirmPassword"
                onChange={(event) => patchPassword("confirmPassword", event.target.value)}
                type="password"
                value={passwordForm.confirmPassword}
              />
            </div>
            {passwordMessage ? (
              <p className={passwordMessage.includes("失败") || passwordMessage.includes("错误") ? "error-text wide" : "success-text wide"}>
                {passwordMessage}
              </p>
            ) : null}
            <button className="primary-button" disabled={isPasswordPending} type="submit">
              <LockKeyhole size={16} />
              修改密码
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
