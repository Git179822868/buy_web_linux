import { prisma } from "@/lib/prisma";

async function getFooterSetting() {
  try {
    return await prisma.siteSetting.findUnique({
      select: {
        copyright: true,
        icpNo: true,
        operator: true,
        siteName: true,
      },
      where: { id: 1 },
    });
  } catch {
    return null;
  }
}

export async function SiteFooter() {
  const setting = await getFooterSetting();
  const year = new Date().getFullYear();
  const siteName = setting?.siteName?.trim() || "账号关注投放商城";
  const copyright = setting?.copyright?.trim() || `© ${year} ${siteName}`;
  const operator = setting?.operator?.trim();
  const icpNo = setting?.icpNo?.trim();

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <span>{copyright}</span>
        {operator ? <span>{operator}</span> : null}
        {icpNo ? (
          <a href="https://beian.miit.gov.cn/" rel="noreferrer" target="_blank">
            {icpNo}
          </a>
        ) : (
          <span>ICP备案信息待配置</span>
        )}
      </div>
    </footer>
  );
}
