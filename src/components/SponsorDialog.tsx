import { useEffect, useState } from "react";
import alipayQr from "../assets/sponsorship/alipay.png";
import wechatQr from "../assets/sponsorship/wechat.png";
import { sponsors } from "../data/sponsors";
import { Icon } from "./Icons";

interface SponsorDialogProps {
  open: boolean;
  onClose: () => void;
  onRegister: () => Promise<void> | void;
}

const REGISTER_URL =
  "https://github.com/Langlijun666/moyue-reader/issues/new?template=sponsorship.yml";

export function SponsorDialog({ open, onClose, onRegister }: SponsorDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setError(null);
      setCopied(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      event.stopPropagation();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop sponsor-backdrop" onClick={onClose}>
      <section
        className="sponsor-dialog"
        role="dialog"
        aria-label="支持墨阅"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sponsor-dialog__header">
          <div>
            <span className="eyebrow">SUPPORT</span>
            <h3>支持墨阅</h3>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="关闭赞助">
            <Icon name="x" size={18} />
          </button>
        </header>

        <div className="sponsor-dialog__body">
          <p className="sponsor-intro">
            如果墨阅帮你省下了一点时间，可以请我喝杯咖啡。
            赞助不会解锁任何功能，所有功能仍然免费。
          </p>

          <div className="sponsor-qr-grid">
            <div className="sponsor-qr-card">
              <div className="sponsor-qr-card__title">
                <span className="sponsor-qr-card__badge sponsor-qr-card__badge--alipay">支</span>
                <span>支付宝</span>
              </div>
              <img src={alipayQr} alt="支付宝赞助二维码" />
              <p>打开支付宝扫一扫</p>
            </div>
            <div className="sponsor-qr-card">
              <div className="sponsor-qr-card__title">
                <span className="sponsor-qr-card__badge sponsor-qr-card__badge--wechat">微</span>
                <span>微信支付</span>
              </div>
              <img src={wechatQr} alt="微信支付赞助二维码" />
              <p>打开微信扫一扫</p>
            </div>
          </div>

          <p className="sponsor-note">
            一次性赞助 · 不解锁功能 · 付款前请确认收款方为「浪里君」
          </p>

          <div className="sponsor-thanks">
            <div className="sponsor-thanks__title">
              <span>感谢支持者</span>
              <small>只显示昵称</small>
            </div>
            <div className="sponsor-list">
              {sponsors.map((sponsor) => (
                <span key={sponsor.name}>{sponsor.name}</span>
              ))}
            </div>
            <p>名单按登记更新。想出现在这里，可以在赞助后登记昵称。</p>
            <div className="sponsor-register-actions">
              <button
                className="button button--ghost sponsor-register"
                onClick={() => {
                  setError(null);
                  void Promise.resolve(onRegister()).catch((registerError) => {
                    setError(
                      registerError instanceof Error
                        ? registerError.message
                        : "无法打开登记页面",
                    );
                  });
                }}
              >
                <Icon name="spark" size={14} />
                赞助后登记名单
              </button>
              <button
                className="button button--ghost sponsor-register"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(REGISTER_URL)
                    .then(() => setCopied(true))
                    .catch(() => setError("复制失败，请手动打开 GitHub 仓库"));
                }}
              >
                {copied ? "已复制链接" : "复制登记链接"}
              </button>
            </div>
            {error ? <p className="sponsor-error">{error}</p> : null}
          </div>

          <p className="sponsor-use">
            赞助主要用于代码签名证书、域名和后续开发。谢谢你把墨阅留在这里。
          </p>
        </div>
      </section>
    </div>
  );
}
