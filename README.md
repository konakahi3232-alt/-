# 食品ロスカードゲーム（サーバー版）

PeerJSを使わず、Node.js + Express + WebSocketでサーバーを介して通信する版です。

## Renderで公開
1. このフォルダをGitHubの新しいリポジトリにアップロード
2. Renderで New → Web Service
3. GitHubのリポジトリを接続
4. Build Command: `npm install`
5. Start Command: `npm start`
6. 無料プランでもテスト可能

公開後のURLを友達に送ります。全員が同じURLを開き、ホストがルームを作り、ルームIDを共有します。

※ルーム情報はサーバーのメモリ上に保持します。サーバーが再起動するとルームは消えます。ゲーム中のリアルタイム通信テスト・イベント利用向けの構成です。
